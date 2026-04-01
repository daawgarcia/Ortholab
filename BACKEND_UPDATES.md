# Backend Updates - Ortholab 2026

Snapshot atualizado em 31/03/2026 com base no código atual em `packages/backend/src`.

## Módulos presentes no backend

O backend hoje possui módulos para:
- admin
- app-modules
- auth
- cases
- chat
- clinical-records
- content
- dentist-financial
- dentists
- documents
- export
- financial
- forms
- mailer
- notifications
- patients
- payments
- planning
- push
- seller
- services
- totvs
- users
- videos
- workflow

## Autenticação

Em `packages/backend/src/modules/auth/auth.routes.ts` existem rotas para:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/me`
- `POST /auth/logout`

O código também usa `APP_URL` para montar o link de redefinição de senha.

## Casos

Em `packages/backend/src/modules/cases/case.routes.ts` existem endpoints para:
- listar casos
- obter detalhes por id
- criar caso
- editar caso
- submeter
- aprovar
- pedir revisão
- alterar status
- solicitar refinamento com `POST /:id/request-refinement`

## E-mails e eventos

Em `packages/backend/src/modules/mailer/event-mailer.ts` existe o fluxo de e-mails do sistema, incluindo o método `onRefinementRequested()`.

## Healthcheck

O backend expõe `GET /health` em `packages/backend/src/server.ts`.

## Deploy e ambiente

Os pontos principais de deploy que conversam com o backend hoje são:
- `render.yaml`
- `.env.example`
- `railway.json` como referência legada

Variáveis importantes documentadas no projeto:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `FRONTEND_URL`
- `APP_URL`
- `SMTP_*`
- `S3_*`
- `TOTVS_*`

## Execução local

```bash
cd packages/backend
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

## Validação recomendada

Após subir localmente, validar manualmente:
- `GET /health`
- login e refresh
- recuperação de senha
- criação e submissão de caso
- mudança de status
- pedido de refinamento

## Observação

Este documento foi ajustado para refletir o estado atual do código e evitar checklists antigos já desatualizados ou contraditórios com o frontend existente.
