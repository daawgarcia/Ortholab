#!/usr/bin/env bash
# Roda na máquina temporária (us-east-1), a cada 10 minutos.
# Tira um SNAPSHOT do disco do Ortholab 1 (só leitura — nada muda no Ortholab 1),
# cria um volume a partir dele, copia o MySQL, gera o dump e envia para o S3 do Ortholab 2.
set -euo pipefail
export AWS_DEFAULT_REGION=us-east-1
INST=i-08117e9d88ac771a8
SRC=vol-0214fb38432543721          # disco do Ortholab 1 (somente snapshot)
AZ=us-east-1c
DEST=s3://ortholab2-arquivos-ea/sync/ol1-latest.sql.gz
MNT=/mnt/ol1sync
WORK=/data/sync
TAGS='{Key=Projeto,Value=ortholab2-sync},{Key=Name,Value=ortholab2-sync}'
log(){ echo "[$(date '+%F %T')] $*"; }

VOL=""
limpar(){
  set +e
  docker rm -f ol1sync >/dev/null 2>&1
  mountpoint -q $MNT && umount $MNT
  if [ -n "$VOL" ]; then
    aws ec2 detach-volume --volume-id "$VOL" >/dev/null 2>&1
    aws ec2 wait volume-available --volume-ids "$VOL"
    aws ec2 delete-volume --volume-id "$VOL" && log "volume temporário $VOL apagado"
  fi
}
trap limpar EXIT

mkdir -p $MNT $WORK
log "criando snapshot de $SRC"
SNAP=$(aws ec2 create-snapshot --volume-id $SRC \
  --description "Ortholab2 sync $(date +%F_%H%M) (somente leitura)" \
  --tag-specifications "ResourceType=snapshot,Tags=[$TAGS]" --query SnapshotId --output text)
for i in $(seq 1 120); do
  ST=$(aws ec2 describe-snapshots --snapshot-ids $SNAP --query 'Snapshots[0].State' --output text)
  [ "$ST" = completed ] && break; sleep 15
done
[ "$ST" = completed ] || { log "snapshot não terminou"; exit 1; }
log "snapshot $SNAP pronto"

VOL=$(aws ec2 create-volume --snapshot-id $SNAP --availability-zone $AZ --volume-type gp3 \
  --tag-specifications "ResourceType=volume,Tags=[$TAGS]" --query VolumeId --output text)
aws ec2 wait volume-available --volume-ids $VOL
aws ec2 attach-volume --volume-id $VOL --instance-id $INST --device /dev/sdh >/dev/null
aws ec2 wait volume-in-use --volume-ids $VOL
DEV=/dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_${VOL/-/}
for i in $(seq 1 60); do [ -e "${DEV}-part1" ] && break; sleep 2; done
mount -o nouuid "${DEV}-part1" $MNT 2>/dev/null || mount "${DEV}-part1" $MNT
log "volume $VOL montado"

rm -rf $WORK/mysql && cp -a $MNT/var/lib/mysql $WORK/mysql
umount $MNT
docker run -d --name ol1sync -v $WORK/mysql:/var/lib/mysql mysql:5.5 --skip-grant-tables >/dev/null
for i in $(seq 1 90); do docker exec ol1sync mysqladmin ping >/dev/null 2>&1 && break; sleep 2; done
docker exec ol1sync mysqldump --single-transaction --routines easysmile_production | gzip > $WORK/ol1.sql.gz.tmp
[ "$(stat -c%s $WORK/ol1.sql.gz.tmp)" -gt 10000000 ] || { log "dump pequeno demais, abortando"; exit 1; }
mv $WORK/ol1.sql.gz.tmp $WORK/ol1.sql.gz
aws s3 cp $WORK/ol1.sql.gz $DEST --only-show-errors
log "dump enviado ($(du -h $WORK/ol1.sql.gz | cut -f1))"

# mantém só o snapshot mais recente da sincronização (o próximo é incremental a partir dele)
for S in $(aws ec2 describe-snapshots --owner-ids self --filters Name=tag:Projeto,Values=ortholab2-sync \
           --query "Snapshots[?SnapshotId!='$SNAP'].SnapshotId" --output text); do
  aws ec2 delete-snapshot --snapshot-id $S && log "snapshot antigo $S apagado"
done
log "ok"
