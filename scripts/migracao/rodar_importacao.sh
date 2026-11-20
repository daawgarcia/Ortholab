#!/usr/bin/env bash
# Roda o importador Ortholab 1 -> Ortholab 2 no servidor (lê a senha do Postgres do deploy/.env).
set -euo pipefail
cd "$(dirname "$0")"
PGPASS=$(grep '^POSTGRES_PASSWORD=' ../../deploy/.env | cut -d= -f2-)
export PG_DSN="postgresql://ortholab:${PGPASS}@127.0.0.1:5433/ortholab_db"
export MYSQL_HOST=127.0.0.1 MYSQL_PORT=3307
mkdir -p /opt/ortholab2/logs
python3 importar_ol1.py 2>&1 | tee -a /opt/ortholab2/logs/importacao.log
