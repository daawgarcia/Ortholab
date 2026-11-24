#!/usr/bin/env bash
# Cópia automática (a cada 10 minutos) dos arquivos novos do Ortholab 1 para o bucket do Ortholab 2.
# Somente LEITURA no bucket antigo. Não roda enquanto a cópia inicial ainda estiver em andamento.
# --copy-props metadata-directive: copia o arquivo e os metadados sem ler as tags do objeto
# (o acesso de leitura ao bucket do Ortholab 1 não inclui s3:GetObjectTagging).
set -uo pipefail
log(){ echo "[$(date '+%F %T')] $*"; }
if systemctl is-active -q ortholab-copia-arquivos; then
  log "cópia inicial ainda em andamento — pulando"
  exit 0
fi
log "início"
SAIDA=$(mktemp)
aws s3 sync s3://ortholab/uploads s3://ortholab2-arquivos-ea/ortholab1-arquivos/uploads \
  --copy-props metadata-directive --no-progress >"$SAIDA" 2>&1
RC=$?
COPIADOS=$(grep -c '^copy:' "$SAIDA" || true)
FALHAS=$(grep -c 'copy failed' "$SAIDA" || true)
# no log vão só o resumo e até 5 falhas (antes cada falha ia inteira para o log, todo ciclo)
grep 'copy failed' "$SAIDA" | head -5
rm -f "$SAIDA"
log "fim: $COPIADOS arquivo(s) novo(s) copiado(s), $FALHAS falha(s), código $RC"
