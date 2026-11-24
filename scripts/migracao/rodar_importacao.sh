#!/usr/bin/env bash
# Importação Ortholab 1 -> Ortholab 2 (usada também na sincronização a cada 10 minutos).
# Lê a senha do Postgres do deploy/.env. Só LÊ o Ortholab 1 (cópia MySQL + bucket).
set -euo pipefail
cd "$(dirname "$0")"
# nunca roda duas importações ao mesmo tempo
exec 9>/tmp/ortholab2-importacao.lock
flock 9
PGPASS=$(grep '^POSTGRES_PASSWORD=' ../../deploy/.env | cut -d= -f2-)
export PG_DSN="postgresql://ortholab:${PGPASS}@127.0.0.1:5433/ortholab_db"
export MYSQL_HOST=127.0.0.1 MYSQL_PORT=3307
LOG=/opt/ortholab2/logs/importacao.log
mkdir -p /opt/ortholab2/logs
python3 importar_ol1.py 2>&1 | tee -a $LOG
python3 importar_ol1_fase2.py 2>&1 | tee -a $LOG
# Checagem Virtual 3D: lê as estimativas no PDF do planejamento dos casos em andamento
command -v pdftotext >/dev/null || sudo apt-get install -y -qq poppler-utils >/dev/null
python3 ler_checagens_ol1.py 2>&1 | tee -a $LOG
