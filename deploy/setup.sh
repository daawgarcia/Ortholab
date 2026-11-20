#!/usr/bin/env bash
# Cria deploy/.env com segredos gerados aqui no servidor.
# As senhas digitadas não aparecem na tela e nunca vão para o git.
set -euo pipefail
cd "$(dirname "$0")"
if [ -f .env ]; then echo ".env já existe — nada a fazer (apague-o para recriar)."; exit 0; fi
rnd() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "$1"; }

read -rsp "Senha inicial do admin (admin@estheticaligner.com.br): " ADMIN_PASS; echo
read -rsp "Senha da caixa ortholab2@estheticaligner.com.br (Enter para pular): " SMTP_PASS; echo

umask 077
cat > .env <<ENV
SITE_DOMAIN=ortholab2.estheticaligner.com.br
POSTGRES_PASSWORD=$(rnd 32)
JWT_SECRET=$(rnd 64)
JWT_REFRESH_SECRET=$(rnd 64)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=https://ortholab2.estheticaligner.com.br
APP_URL=https://ortholab2.estheticaligner.com.br
API_PUBLIC_URL=https://ortholab2.estheticaligner.com.br
SEED_ADMIN_PASSWORD=${ADMIN_PASS}

# E-mail (ambiente de TESTE: tudo é desviado para a caixa de teste)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=ortholab2@estheticaligner.com.br
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=Ortholab 2 (teste) <ortholab2@estheticaligner.com.br>
MAIL_REDIRECT_ALL_TO=testeortholab2@estheticaligner.com.br
MAILER_DOC_EMAIL=doc2@estheticaligner.com.br
MAILER_FINANCIAL_EMAIL=faturamento2@estheticaligner.com.br

# Arquivos: bucket S3 novo, acesso pela permissão (IAM role) do servidor, sem chaves
S3_ENDPOINT=https://s3.sa-east-1.amazonaws.com
S3_BUCKET=ortholab2-arquivos-ea
S3_REGION=sa-east-1

# TOTVS: somente leitura nos testes (envio de pacientes desligado)
TOTVS_ENABLED=false
ENV
echo "deploy/.env criado (permissão 600)."
