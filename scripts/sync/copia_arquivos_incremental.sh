#!/usr/bin/env bash
# Cópia automática (a cada 10 minutos) dos arquivos novos do Ortholab 1 para o bucket do Ortholab 2.
# Somente LEITURA no bucket antigo. Não roda enquanto a cópia inicial ainda estiver em andamento.
set -euo pipefail
log(){ echo "[$(date '+%F %T')] $*"; }
if systemctl is-active -q ortholab-copia-arquivos; then
  log "cópia inicial ainda em andamento — pulando"
  exit 0
fi
log "início"
aws s3 sync s3://ortholab/uploads s3://ortholab2-arquivos-ea/ortholab1-arquivos/uploads --only-show-errors --no-progress
log "fim"
