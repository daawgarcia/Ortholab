#!/usr/bin/env bash
# Instala no servidor do Ortholab 2 o recebimento automático do Ortholab 1 (a cada 10 min).
set -euo pipefail
cat > /etc/systemd/system/ortholab2-sync.service <<'U'
[Unit]
Description=Ortholab 2 - recebe dump do Ortholab 1 e importa
[Service]
Type=oneshot
ExecStart=/bin/bash /opt/ortholab2/app/scripts/sync/ol2_receber.sh
StandardOutput=append:/opt/ortholab2/logs/sync.log
StandardError=append:/opt/ortholab2/logs/sync.log
U
cat > /etc/systemd/system/ortholab2-sync.timer <<'U'
[Unit]
Description=Ortholab 2 - sincronização com o Ortholab 1 (a cada 10 min)
[Timer]
OnBootSec=5min
OnUnitActiveSec=10min
Persistent=true
[Install]
WantedBy=timers.target
U
cat > /etc/systemd/system/ortholab2-copia-incremental.service <<'U'
[Unit]
Description=Ortholab 2 - copia arquivos novos do Ortholab 1 (somente leitura no bucket antigo)
[Service]
Type=oneshot
ExecStart=/bin/bash /opt/ortholab2/app/scripts/sync/copia_arquivos_incremental.sh
StandardOutput=append:/opt/ortholab2/logs/copia-arquivos.log
StandardError=append:/opt/ortholab2/logs/copia-arquivos.log
U
cat > /etc/systemd/system/ortholab2-copia-incremental.timer <<'U'
[Unit]
Description=Ortholab 2 - copia de arquivos de hora em hora
[Timer]
OnCalendar=*-*-* *:35:00
Persistent=true
[Install]
WantedBy=timers.target
U
mkdir -p /opt/ortholab2/logs
# script da máquina temporária fica no S3 para ela baixar
aws s3 cp /opt/ortholab2/app/scripts/sync/ol1_snapshot_dump.sh s3://ortholab2-arquivos-ea/sync/scripts/ol1_snapshot_dump.sh --only-show-errors
aws s3 cp /opt/ortholab2/app/scripts/sync/instalar_temp.sh s3://ortholab2-arquivos-ea/sync/scripts/instalar_temp.sh --only-show-errors
systemctl daemon-reload
systemctl enable --now ortholab2-sync.timer ortholab2-copia-incremental.timer
echo "ortholab2-sync.timer ativo"
