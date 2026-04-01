# Ortholab 2026 - Resumo de Implementação

Snapshot documental atualizado em 31/03/2026 com base no código atual do repositório.

## Situação geral

O projeto está estruturado como monorepo npm com:
- backend em `packages/backend`
- frontend em `packages/frontend`
- deploy principal documentado para Render + Vercel

Os arquivos de deploy atualmente válidos são:
- `render.yaml`
- `packages/frontend/vercel.json`
- `.env.example`

## Backend implementado

### Autenticação
Em `packages/backend/src/modules/auth/auth.routes.ts` existem rotas para:
- login
- refresh de token
- recuperação e redefinição de senha
- logout autenticado
- leitura do usuário atual

O fluxo documentado no código usa:
- access token de curta duração
- refresh token para renovação de sessão
- `APP_URL` para geração do link de reset de senha

### Casos e pipeline
Em `packages/backend/src/modules/cases/case.routes.ts` existem operações para:
- listagem e detalhe de casos
- criação e edição
- submissão
- aprovação
- pedido de revisão
- mudança de status
- criação de refinamento com `POST /:id/request-refinement`

### Eventos e e-mails
Em `packages/backend/src/modules/mailer/event-mailer.ts` existe suporte aos eventos de e-mail do fluxo de casos, incluindo `onRefinementRequested()`.

### Healthcheck
O backend expõe `GET /health` em `packages/backend/src/server.ts`.

## Frontend implementado

### Fluxo de autenticação
No frontend existem:
- páginas de login, cadastro, recuperação e reset de senha
- store de autenticação com Zustand
- interceptor de API com refresh automático em 401
- hook `useTokenRefresh()` para renovação periódica da sessão

Arquivos centrais:
- `packages/frontend/src/lib/api.ts`
- `packages/frontend/src/store/auth.ts`
- `packages/frontend/src/hooks/use-token-refresh.ts`
- `packages/frontend/src/App.tsx`

### Navegação protegida
O `App.tsx` usa `ProtectedRoute` e organiza rotas por perfil para áreas como:
- dashboard
- patients
- dentists
- cases
- workflow
- financial
- seller
- chat
- módulos administrativos

### Pushes pendentes
O frontend consulta pushes pendentes e abre modal quando houver itens para o usuário autenticado.

## Infra e deploy

Hoje a referência correta de deploy é:
- GitHub: `https://github.com/daawgarcia/ortholab.git`
- Render para backend, PostgreSQL e Redis
- Vercel para o frontend principal

Observações importantes:
- `vercel.json` na raiz está vazio
- a configuração útil da Vercel está em `packages/frontend/vercel.json`
- `railway.json` permanece apenas como arquivo legado de referência

## Como rodar localmente

### Backend
```bash
cd packages/backend
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

### Frontend
```bash
cd packages/frontend
npm install
npm run dev
```

Para o frontend local, definir:

```env
VITE_API_URL=http://localhost:3001
```

## Pontos ainda dependentes de validação funcional

Este resumo confirma a presença das rotas, módulos e arquivos no código, mas não substitui validação manual de negócio para:
- fluxo completo de pagamento
- integração SMTP real
- integração S3 real
- comportamento em produção por perfil

## Referências cruzadas
- `README.md`
- `DEPLOY.md`
- `DEPLOY_RENDER.md`
- `BACKEND_UPDATES.md`
- `FRONTEND_STATUS.md`
