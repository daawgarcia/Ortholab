# Restaurar o banco do Ortholab 2 a partir do backup

```bash
aws s3 ls s3://ortholab2-arquivos-ea/backups/diario/          # escolha a data
aws s3 cp s3://ortholab2-arquivos-ea/backups/diario/AAAA-MM-DD.dump /tmp/r.dump
cd /opt/ortholab2/app/deploy
docker compose stop backend
docker compose exec -T postgres pg_restore -U ortholab -d ortholab_db --clean --if-exists < /tmp/r.dump
docker compose start backend
```
