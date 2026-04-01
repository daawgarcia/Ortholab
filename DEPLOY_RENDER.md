# Deploy no Render

Este guia está alinhado com o arquivo `render.yaml` atual do projeto.

Snapshot documental atualizado em 31/03/2026.

## O que o blueprint cria

O `render.yaml` provisiona automaticamente:

| Serviço | Tipo | Nome no blueprint |
|---|---|---|
| Backend API | Web Service | `ortholab-backend` |
| PostgreSQL | Private Service | `ortholab-postgres` |
| Redis | Redis | `ortholab-redis` |
| Frontend estático | Web Static | `ortholab-frontend` |

## Build e start reais do backend

### Build

```bash
cd packages/backend && npm install && npm run db:generate && npm run build
```

### Start

```bash
cd packages/backend && npm run db:migrate && node dist/server.js
```

## Variáveis definidas no próprio render.yaml

Já saem configuradas automaticamente:

| Variável | Valor atual |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `SMTP_PORT` | `587` |
| `SMTP_FROM` | `noreply@estheticaligner.com.br` |
| `S3_ENDPOINT` | `s3.amazonaws.com` |
| `S3_BUCKET` | `ortholab-files` |
| `TOTVS_ENABLED` | `false` |
| `DATABASE_URL` | vindo de `database.internal_url` |

## Variáveis que precisam ser preenchidas manualmente

Estas estão com `sync: false` ou `generateValue`:

| Variável | Como preencher |
|---|---|
| `JWT_SECRET` | deixar o Render gerar |
| `JWT_REFRESH_SECRET` | deixar o Render gerar |
| `SMTP_HOST` | host SMTP real |
| `SMTP_USER` | usuário SMTP |
| `SMTP_PASS` | senha SMTP |
| `S3_ACCESS_KEY` | chave do storage |
| `S3_SECRET_KEY` | segredo do storage |

## URLs configuradas hoje no blueprint

O arquivo atual define:

```env
FRONTEND_URL=https://ortholab-frontend.onrender.com
APP_URL=https://ortholab-frontend.onrender.com
VITE_API_URL=https://ortholab-backend.onrender.com
```

Se o frontend oficial estiver na Vercel, trocar `FRONTEND_URL` e `APP_URL` para a URL final da Vercel.

## Como publicar via Blueprint

1. Acessar o painel do Render.
2. Criar um novo Blueprint.
3. Conectar o repositório GitHub `daawgarcia/ortholab`.
4. Confirmar leitura do `render.yaml`.
5. Revisar nomes, plano e variáveis.
6. Executar o deploy.

## Como publicar manualmente sem Blueprint

### Backend
- Runtime: Node
- Root directory: projeto inteiro, com comandos usando `cd packages/backend`
- Build command: igual ao `render.yaml`
- Start command: igual ao `render.yaml`

### PostgreSQL
- Criar banco PostgreSQL no Render
- Ligar a `DATABASE_URL` ao backend

### Redis
- Criar instância Redis no Render

### Frontend estático no Render
- Runtime: Static Site
- Build command: `cd packages/frontend && npm install && npm run build`
- Publish directory: `packages/frontend/dist`
- Variável: `VITE_API_URL=https://SEU-BACKEND.onrender.com`

## Testes rápidos após o deploy

### Healthcheck

```bash
curl https://SEU-BACKEND.onrender.com/health
```

### Login

```bash
curl -X POST https://SEU-BACKEND.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@estheticaligner.com.br","password":"Admin@123"}'
```

## Problemas comuns

### Backend sobe sem conectar no banco
- Confirmar se o `DATABASE_URL` veio do serviço PostgreSQL do Render.
- Verificar logs da migration no start.

### Frontend sem comunicação com API
- Confirmar `VITE_API_URL`.
- Conferir se o backend está com CORS aceitando a URL correta do frontend.

### E-mails falhando
- Revisar `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`.
- Se usar Gmail, usar senha de app.

### Upload falhando
- Revisar `S3_ACCESS_KEY`, `S3_SECRET_KEY`, bucket e endpoint.

## Referências
- `render.yaml`
- `DEPLOY.md`
- `README.md`
- `.env.example`
