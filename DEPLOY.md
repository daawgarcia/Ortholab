# Deploy Ortholab 2026

Este documento foi atualizado com base no estado atual do repositório, usando como fonte os arquivos `render.yaml`, `packages/frontend/vercel.json`, `railway.json`, `.env.example` e o remoto GitHub configurado.

Snapshot documental atualizado em 31/03/2026.

## Stack de deploy em uso
- Código-fonte: GitHub em `https://github.com/daawgarcia/ortholab.git`
- Backend: Render Web Service
- Banco: Render PostgreSQL
- Cache/fila: Render Redis
- Frontend principal: Vercel
- Frontend alternativo: Render Static Site já descrito no blueprint

## Estrutura relevante do monorepo

```text
Ortholab_2026/
|-- package.json
|-- .env.example
|-- docker-compose.yml
|-- render.yaml
|-- vercel.json
|-- railway.json
`-- packages/
    |-- backend/
    |   |-- package.json
    |   `-- src/
    `-- frontend/
        |-- package.json
        |-- vercel.json
        `-- src/
```

## Deploy recomendado

### 1. Publicar o repositório no GitHub
O remoto atual já aponta para:

```bash
https://github.com/daawgarcia/ortholab.git
```

Se o deploy estiver ligado a outra conta ou outro repositório, alinhar primeiro no GitHub antes de importar em Render e Vercel.

### 2. Subir backend, PostgreSQL e Redis no Render

No Render:
1. New +
2. Blueprint
3. Selecionar o repositório GitHub do Ortholab
4. Confirmar o arquivo `render.yaml`
5. Preencher as variáveis com `sync: false`
6. Executar o deploy

O blueprint cria estes serviços:
- `ortholab-backend`
- `ortholab-postgres`
- `ortholab-redis`
- `ortholab-frontend` (opcional se o frontend principal ficar na Vercel)

### 3. Subir o frontend na Vercel

Na Vercel:
1. Add New Project
2. Import Git Repository
3. Selecionar o mesmo repositório
4. Definir Root Directory como `packages/frontend`
5. Usar o `packages/frontend/vercel.json`
6. Configurar `VITE_API_URL`
7. Fazer o deploy

## Comandos de build já definidos

### Backend
- Build: `cd packages/backend && npm install && npm run db:generate && npm run build`
- Start: `cd packages/backend && npm run db:migrate && node dist/server.js`
- Healthcheck legado em `railway.json`: `/health`

### Frontend
- Build: `npm run build`
- Output: `dist`
- Rewrite SPA: todas as rotas apontam para `index.html`

## Variáveis obrigatórias

### Render / backend

```env
DATABASE_URL=
NODE_ENV=production
PORT=3001

JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

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

### Vercel / frontend

```env
VITE_API_URL=https://SEU-BACKEND.onrender.com
```

## Observações importantes
- O `vercel.json` na raiz está vazio. A configuração útil hoje está em `packages/frontend/vercel.json`.
- O `railway.json` continua no projeto, mas hoje serve apenas como referência legada de build e healthcheck.
- Se o frontend for servido pela Vercel, ajustar no Render as variáveis `FRONTEND_URL` e `APP_URL` com a URL final da Vercel.
- Se optar por usar o frontend estático do próprio Render, então `VITE_API_URL` do serviço `ortholab-frontend` precisa apontar para o backend do Render.

## Checklist de validação pós-deploy
1. Abrir o frontend publicado e validar carregamento da SPA.
2. Testar login com o backend publicado.
3. Confirmar resposta do healthcheck do backend.
4. Verificar logs do Render em caso de erro de migration ou variáveis ausentes.
5. Validar upload e envio de e-mail, caso SMTP e S3 estejam ativos.

## Credencial inicial

| E-mail | Senha | Perfil |
|---|---|---|
| admin@estheticaligner.com.br | Admin@123 | ADMIN |

Trocar a senha após o primeiro acesso.

## Referências
- `README.md`
- `DEPLOY_RENDER.md`
- `IMPLEMENTATION_SUMMARY.md`
- `.env.example`
- `render.yaml`
