#!/usr/bin/env bash
# Copia primeiro os arquivos (fotos, STL, PDFs e vídeos) dos pacientes com caso em andamento.
# Somente LEITURA no bucket do Ortholab 1. Pula o que já existe no bucket do Ortholab 2.
set -uo pipefail
cd "$(dirname "$0")/../.."
PGPASS=$(grep '^POSTGRES_PASSWORD=' deploy/.env | cut -d= -f2-)
export PG_DSN="postgresql://ortholab:${PGPASS}@127.0.0.1:5433/ortholab_db"
LISTA=/tmp/copia_prioritaria.txt
python3 - > "$LISTA" <<'EOF'
import os, psycopg2
from urllib.parse import unquote
base = "/ortholab1-arquivos/uploads/"
c = psycopg2.connect(os.environ["PG_DSN"]).cursor()
c.execute("""
  WITH ativos AS (SELECT DISTINCT "patientId" AS id FROM "Case" WHERE status NOT IN ('COMPLETED','DRAFT'))
  SELECT url FROM "WorkFile" WHERE "patientId" IN (SELECT id FROM ativos)
  UNION ALL SELECT url FROM "Photo" WHERE "patientId" IN (SELECT id FROM ativos)
  UNION ALL SELECT url FROM "DigitalModel" WHERE "patientId" IN (SELECT id FROM ativos)""")
for (u,) in c.fetchall():
    if u and base in u:
        print(unquote(u.split(base, 1)[1]))
EOF
TOTAL=$(wc -l < "$LISTA")
echo "[$(date '+%F %T')] prioritária: $TOTAL arquivo(s) de pacientes com caso em andamento"
copiar(){
  k="$1"
  aws s3api head-object --bucket ortholab2-arquivos-ea --key "ortholab1-arquivos/uploads/$k" >/dev/null 2>&1 && { echo JA; return; }
  aws s3 cp "s3://ortholab/uploads/$k" "s3://ortholab2-arquivos-ea/ortholab1-arquivos/uploads/$k" \
    --copy-props metadata-directive --only-show-errors >/dev/null 2>&1 && echo OK || echo FALHA
}
export -f copiar
R=$(tr '\n' '\0' < "$LISTA" | xargs -0 -P 24 -I{} bash -c 'copiar "$1"' _ {} | sort | uniq -c | tr '\n' ' ')
echo "[$(date '+%F %T')] prioritária: fim — $R"
