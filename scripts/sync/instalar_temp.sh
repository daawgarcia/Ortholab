#!/usr/bin/env bash
# Instala na máquina temporária (us-east-1) o snapshot + dump do Ortholab 1 de hora em hora.
set -euo pipefail
mkdir -p /opt/ol2sync /data/sync
aws s3 cp s3://ortholab2-arquivos-ea/sync/scripts/ol1_snapshot_dump.sh /opt/ol2sync/ol1_snapshot_dump.sh --only-show-errors --region sa-east-1
chmod +x /opt/ol2sync/ol1_snapshot_dump.sh
cat > /etc/systemd/system/ol1-snapshot-dump.service <<'U'
[Unit]
Description=Ortholab 2 - snapshot (somente leitura) e dump do Ortholab 1
After=docker.service
[Service]
Type=oneshot
TimeoutStartSec=50min
ExecStart=/bin/bash /opt/ol2sync/ol1_snapshot_dump.sh
StandardOutput=append:/var/log/ol1-snapshot-dump.log
StandardError=append:/var/log/ol1-snapshot-dump.log
U
cat > /etc/systemd/system/ol1-snapshot-dump.timer <<'U'
[Unit]
Description=Ortholab 2 - dump do Ortholab 1 de hora em hora
[Timer]
OnCalendar=*-*-* *:05:00
Persistent=true
[Install]
WantedBy=timers.target
U
systemctl daemon-reload
systemctl enable --now ol1-snapshot-dump.timer
echo "ol1-snapshot-dump.timer ativo"
