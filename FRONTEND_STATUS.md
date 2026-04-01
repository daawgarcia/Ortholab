# Frontend Status - Ortholab 2026

Snapshot atualizado em 31/03/2026 a partir do código em `packages/frontend/src`.

## Estado atual do frontend

O frontend está estruturado em React + Vite e já possui:
- autenticação
- rotas protegidas por perfil
- layout principal autenticado
- páginas para pacientes, dentistas, casos, workflow, financeiro, vendedor e administração
- integração de refresh de token e leitura de pushes pendentes

## Arquivos centrais

### Aplicação e rotas
- `packages/frontend/src/App.tsx`
- `packages/frontend/src/components/layout/app-layout`

### Autenticação
- `packages/frontend/src/pages/auth/login.tsx`
- `packages/frontend/src/pages/auth/register.tsx`
- `packages/frontend/src/pages/auth/forgot-password.tsx`
- `packages/frontend/src/pages/auth/reset-password.tsx`
- `packages/frontend/src/store/auth.ts`
- `packages/frontend/src/hooks/use-token-refresh.ts`
- `packages/frontend/src/lib/api.ts`

## Rotas presentes hoje

O `App.tsx` registra rotas para as áreas:
- dashboard
- patients
- dentists
- cases
- workflow
- financial
- seller
- chat
- profile
- prices-rules
- video-aulas
- webinars
- administração de usuários, serviços, conteúdo, vídeos, pushes, módulos, configurações e cupons

## Controle de acesso

Existe `ProtectedRoute` no `App.tsx` com redirecionamento para `/login` quando não há usuário autenticado.

Há restrição por perfil em grupos como:
- pacientes
- dentistas
- workflow
- financeiro
- seller
- administração

## Fluxo de sessão

O frontend usa Zustand para manter:
- `user`
- `accessToken`
- `refreshToken`
- `pendingPushes`

Comportamentos confirmados no código:
- refresh automático em respostas 401 no interceptor
- hook `useTokenRefresh()` ativo globalmente no `App.tsx`
- polling de pushes pendentes a cada 60 segundos quando há usuário logado
- modal de pushes aberto quando existem itens pendentes

## Deploy do frontend

A configuração de deploy útil da Vercel está em:
- `packages/frontend/vercel.json`

Pontos documentados:
- root directory esperado na Vercel: `packages/frontend`
- build command: `npm run build`
- output: `dist`
- variável principal: `VITE_API_URL`

Observação:
- `vercel.json` na raiz do repositório está vazio e não deve ser usado como fonte principal

## Execução local

```bash
cd packages/frontend
npm install
npm run dev
```

Definir também:

```env
VITE_API_URL=http://localhost:3001
```

## O que este documento confirma

Este status confirma presença estrutural e integração no frontend para:
- auth pages
- rotas protegidas
- refresh de sessão
- pushes pendentes
- áreas funcionais já mapeadas no router

## O que ainda precisa de validação manual

Este documento não afirma cobertura completa de negócio nem QA final para:
- cada formulário por página
- consistência visual de todas as telas
- integração ponta a ponta de todos os módulos
- comportamento por role em produção

## Referências
- `IMPLEMENTATION_SUMMARY.md`
- `BACKEND_UPDATES.md`
- `README.md`
- `DEPLOY.md`
