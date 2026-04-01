# Ortholab 2026

Portal digital do laboratório para envio e acompanhamento de casos ortodônticos.

Snapshot documental atualizado em 31/03/2026.

## Stack
- Frontend: React + Vite + Tailwind CSS + shadcn/ui
- Backend: Node.js + Fastify + TypeScript + Prisma
- Banco: PostgreSQL
- Cache/fila: Redis
- Storage: MinIO / S3

## Repositório
- GitHub remoto atual: `https://github.com/daawgarcia/ortholab.git`
- Monorepo com workspaces npm em `packages/backend` e `packages/frontend`

## Deploy atual

### Backend e infraestrutura → Render
O arquivo `render.yaml` já define:
- `ortholab-backend` como serviço web Node.js
- `ortholab-postgres` como PostgreSQL gerenciado
- `ortholab-redis` como Redis gerenciado
- `ortholab-frontend` como static site opcional no próprio Render

Fluxo resumido:
1. Conectar o repositório GitHub no Render via Blueprint
2. Importar o `render.yaml`
3. Preencher os segredos pendentes (`SMTP_*`, `S3_*` e afins)
4. Ajustar `FRONTEND_URL` e `APP_URL` para a URL real do frontend publicado

### Frontend → Vercel
O frontend Vite deve ser publicado a partir de `packages/frontend`.

Arquivos relevantes:
- Configuração de rewrite/cache: `packages/frontend/vercel.json`
- Configuração de build local: `packages/frontend/package.json`
- O `vercel.json` na raiz está vazio e não deve ser usado como referência principal

Configuração esperada na Vercel:
- Root Directory: `packages/frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

Variável obrigatória na Vercel:

```env
VITE_API_URL=https://SEU-BACKEND.onrender.com
```

## Variáveis de ambiente principais

### Backend / Render

```env
DATABASE_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://SEU-FRONTEND.vercel.app
APP_URL=https://SEU-FRONTEND.vercel.app

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Esthetic Aligner <noreply@estheticaligner.com.br>

S3_ENDPOINT=s3.amazonaws.com
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=ortholab-files
S3_REGION=us-east-1

TOTVS_ENABLED=false
TOTVS_BASE_URL=
TOTVS_API_KEY=
TOTVS_WEBHOOK_SECRET=
```

### Frontend / Vercel

```env
VITE_API_URL=https://SEU-BACKEND.onrender.com
```

## Scripts úteis

Na raiz do projeto:

```bash
npm run dev:backend
npm run dev:frontend
npm run build:backend
npm run build:frontend
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Credenciais padrão após seed

| E-mail | Senha | Perfil |
|--------|-------|--------|
| admin@estheticaligner.com.br | Admin@123 | ADMIN |

Trocar a senha no primeiro acesso.

## Referências
- `DEPLOY.md`
- `DEPLOY_RENDER.md`
- `IMPLEMENTATION_SUMMARY.md`
- `BACKEND_UPDATES.md`
- `FRONTEND_STATUS.md`
