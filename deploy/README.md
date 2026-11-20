# Deploy — Ortholab 2 (AWS São Paulo)

Servidor `ortholab2-servidor` (IP fixo 54.94.213.191) · domínio `ortholab2.estheticaligner.com.br` · HTTPS automático (Caddy/Let's Encrypt).

Primeira instalação (no servidor):

```bash
git clone -b deploy/aws-sao-paulo https://github.com/daawgarcia/ortholab /opt/ortholab2/app
cd /opt/ortholab2/app/deploy
./setup.sh                       # pede a senha do admin e da caixa ortholab2@ (não aparecem na tela)
docker compose up -d --build     # build + sobe postgres, backend e web
docker compose exec backend npx tsx prisma/seed.ts   # cria o admin (troca de senha no 1º acesso)
```

Atualizar depois: `git pull && docker compose up -d --build`.

Ambiente de TESTE: `MAIL_REDIRECT_ALL_TO` desvia todos os e-mails para `testeortholab2@`; TOTVS só leitura.
