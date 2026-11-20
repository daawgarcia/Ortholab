#!/usr/bin/env bash
# Roda no servidor do Ortholab 2 (sa-east-1) a cada 10 min.
# Se houver um dump novo do Ortholab 1 no S3, carrega na cópia MySQL (ol1raw) e roda a importação.
set -euo pipefail
SRC=s3://ortholab2-arquivos-ea/sync/ol1-latest.sql.gz
STATE=/opt/ortholab2/sync
APP=/opt/ortholab2/app
mkdir -p $STATE
log(){ echo "[$(date '+%F %T')] $*"; }

ETAG=$(aws s3api head-object --bucket ortholab2-arquivos-ea --key sync/ol1-latest.sql.gz --query ETag --output text 2>/dev/null || true)
[ -n "$ETAG" ] || { log "sem dump no S3 ainda"; exit 0; }
[ "$ETAG" = "$(cat $STATE/ultimo_etag 2>/dev/null)" ] && exit 0

log "dump novo ($ETAG) — baixando"
aws s3 cp $SRC $STATE/ol1.sql.gz --only-show-errors --region sa-east-1
docker exec ol1raw mysql -uroot -e "DROP DATABASE IF EXISTS ol1_novo; CREATE DATABASE ol1_novo CHARACTER SET utf8"
gunzip -c $STATE/ol1.sql.gz | docker exec -i ol1raw mysql -uroot ol1_novo
# troca atômica: ol1_novo -> ol1 (renomeando tabela a tabela)
TABS=$(docker exec ol1raw mysql -uroot -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema='ol1_novo'")
docker exec ol1raw mysql -uroot -e "DROP DATABASE IF EXISTS ol1_antigo; CREATE DATABASE ol1_antigo CHARACTER SET utf8; CREATE DATABASE IF NOT EXISTS ol1"
REN=""
for t in $TABS; do
  EXISTE=$(docker exec ol1raw mysql -uroot -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='ol1' AND table_name='$t'")
  [ "$EXISTE" = 1 ] && REN="$REN ol1.\`$t\` TO ol1_antigo.\`$t\`,"
  REN="$REN ol1_novo.\`$t\` TO ol1.\`$t\`,"
done
docker exec ol1raw mysql -uroot -e "RENAME TABLE ${REN%,}"
docker exec ol1raw mysql -uroot -e "DROP DATABASE ol1_antigo; DROP DATABASE ol1_novo"
log "cópia do Ortholab 1 atualizada"

cd $APP && bash scripts/migracao/rodar_importacao.sh
echo "$ETAG" > $STATE/ultimo_etag
log "sincronização concluída"
