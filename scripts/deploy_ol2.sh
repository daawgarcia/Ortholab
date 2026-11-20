#!/usr/bin/env bash
# Atualiza o Ortholab 2 no servidor: build, sobe os containers, preços e importação.
# Uso: sudo systemd-run --unit=ol2-deploy --collect bash /opt/ortholab2/app/scripts/deploy_ol2.sh
set -uo pipefail
LOG=/opt/ortholab2/logs/deploy.log
exec >"$LOG" 2>&1
cd /opt/ortholab2/app
git -c safe.directory=/opt/ortholab2/app log --oneline -1
cd deploy
docker compose build && docker compose up -d || { echo "BUILD_FALHOU"; exit 1; }
sleep 30
curl -s -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:3001/health
cd /opt/ortholab2/app
PGPASS=$(grep '^POSTGRES_PASSWORD=' deploy/.env | cut -d= -f2-)
export PG_DSN="postgresql://ortholab:${PGPASS}@127.0.0.1:5433/ortholab_db"
python3 scripts/precos/cadastrar_precos.py
bash scripts/migracao/rodar_importacao.sh >/dev/null && echo IMPORT_OK
echo FIM
