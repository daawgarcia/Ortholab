#!/usr/bin/env bash
# Backup diário do banco do Ortholab 2 -> S3 (bucket privado, versionado).
#   s3://ortholab2-arquivos-ea/backups/diario/AAAA-MM-DD.sql.gz   (mantidos 35 dias)
#   s3://ortholab2-arquivos-ea/backups/mensal/AAAA-MM.sql.gz      (dia 1 — mantidos para sempre)
set -euo pipefail
cd "$(dirname "$0")/../../deploy"
DIA=$(date +%F); MES=$(date +%Y-%m)
TMP=/opt/ortholab2/backup; mkdir -p $TMP
log(){ echo "[$(date '+%F %T')] $*"; }
log "gerando dump"
docker compose exec -T postgres pg_dump -U ortholab -d ortholab_db --format=custom --compress=6 > $TMP/ortholab2.dump
TAM=$(stat -c%s $TMP/ortholab2.dump)
[ "$TAM" -gt 1000000 ] || { log "dump pequeno demais ($TAM bytes) — abortando"; exit 1; }
aws s3 cp $TMP/ortholab2.dump s3://ortholab2-arquivos-ea/backups/diario/$DIA.dump --only-show-errors --region sa-east-1
if [ "$(date +%d)" = "01" ] || ! aws s3 ls s3://ortholab2-arquivos-ea/backups/mensal/$MES.dump >/dev/null 2>&1; then
  aws s3 cp $TMP/ortholab2.dump s3://ortholab2-arquivos-ea/backups/mensal/$MES.dump --only-show-errors --region sa-east-1
  log "cópia mensal $MES gravada"
fi
# apaga diários com mais de 35 dias
LIMITE=$(date -d '35 days ago' +%F)
aws s3 ls s3://ortholab2-arquivos-ea/backups/diario/ --region sa-east-1 | awk '{print $4}' | while read -r f; do
  d=${f%.dump}; [[ "$d" < "$LIMITE" ]] && aws s3 rm "s3://ortholab2-arquivos-ea/backups/diario/$f" --only-show-errors --region sa-east-1 && log "removido $f"
done
rm -f $TMP/ortholab2.dump
log "backup ok ($((TAM/1024/1024)) MB)"
