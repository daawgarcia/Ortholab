#!/usr/bin/env bash
# Cria (ou atualiza) um DENTISTA DE TESTE no Ortholab 2.
# A senha é digitada por você aqui no servidor (não aparece na tela nem fica em arquivo).
set -euo pipefail
cd "$(dirname "$0")/../deploy"
read -rp "E-mail do dentista de teste: " EMAIL
read -rp "Nome que vai aparecer (ex.: Dentista Teste): " NOME
read -rsp "Senha (mín. 8 caracteres): " SENHA; echo
read -rsp "Repita a senha: " SENHA2; echo
[ "$SENHA" = "$SENHA2" ] || { echo "As senhas não conferem."; exit 1; }
[ ${#SENHA} -ge 8 ] || { echo "Senha muito curta."; exit 1; }
docker compose exec -T -e T_EMAIL="$EMAIL" -e T_NOME="$NOME" -e T_SENHA="$SENHA" backend node -e '
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
(async () => {
  const p = new PrismaClient();
  const email = process.env.T_EMAIL.trim().toLowerCase();
  const password = await bcrypt.hash(process.env.T_SENHA, 12);
  const u = await p.user.upsert({
    where: { email },
    update: { password, name: process.env.T_NOME, role: "DENTIST", status: "ACTIVE" },
    create: { email, password, name: process.env.T_NOME, role: "DENTIST", status: "ACTIVE",
              clinic: "Clínica de Teste", city: "Santo André", state: "SP" },
  });
  console.log("Dentista de teste pronto:", u.email);
  await p.$disconnect();
})().catch(e => { console.error("Erro:", e.message); process.exit(1); });
'
