# Ortholab — Esthetic Aligner

Portal digital do laboratório para envio e acompanhamento de casos ortodônticos.

## Stack
- Frontend: React + Vite + Tailwind CSS + shadcn/ui
- Backend: Node.js + Fastify + TypeScript + Prisma
- Banco: PostgreSQL
- Storage: MinIO / S3

## Deploy

### Backend → Railway
1. Acesse [railway.app](https://railway.app)
2. New Project → Deploy from GitHub → selecione este repo
3. Adicione um serviço **PostgreSQL** (botão `+ New` → Database → PostgreSQL)
4. Configure as variáveis de ambiente (veja `.env.example`)
5. O `railway.json` já está configurado

### Frontend → Vercel
1. Acesse [vercel.com](https://vercel.com)
2. New Project → Import Git Repository → selecione este repo
3. Configure a variável: `VITE_API_URL=https://SEU-BACKEND.railway.app`
4. O `vercel.json` já está configurado

## Variáveis de ambiente necessárias no Railway

```
DATABASE_URL=          ← gerado automaticamente pelo PostgreSQL do Railway
JWT_SECRET=            ← string aleatória longa
JWT_REFRESH_SECRET=    ← string aleatória longa
FRONTEND_URL=          ← URL do seu deploy no Vercel
S3_ENDPOINT=           ← MinIO ou S3
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=ortholab-files
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@estheticaligner.com.br
APP_URL=               ← URL do Vercel
PORT=3001
NODE_ENV=production
```

## Credenciais padrão (após seed automático)

| E-mail | Senha | Perfil |
|--------|-------|--------|
| admin@estheticaligner.com.br | Admin@123 | ADMIN |

> Troque a senha no primeiro acesso!
