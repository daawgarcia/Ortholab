# Backend Updates - Ortholab 2026

## ✅ Concluído (Semana 1)

### 1. EventMailer - 100% COMPLETO
**Arquivo:** `packages/backend/src/modules/mailer/event-mailer.ts`

Todos os 11 eventos implementados:
- `onCaseSubmitted()` - Enviado para Admin, Lab, Seller
- `onCasePlanningStarted()` - Dentista recebe notificação  
- `onSetupReady()` - Dentista pode aprovar
- `onRevisionRequested()` - Lab + Admin revisam
- `onCaseApproved()` - Lab + Admin + Financeiro confirmam
- `onCaseInProduction()` - Dentista informado
- `onCaseShipped()` - Com código de rastreamento
- `onCaseCompleted()` - Dentista + Seller recebem
- `onPaymentConfirmed()` - Dentista + Financeiro + Admin
- `onPaymentFailed()` - Dentista tenta novamente
- `onRefinementRequested()` - Lab + Admin para novo refinamento

**Templates:** Respondivos, HTML branded com cores EA (azul/rosa), links diretos para casos.

### 2. Auth - 100% COMPLETO
**Arquivo:** `packages/backend/src/modules/auth/auth.routes.ts`

Endpoints:
- `POST /api/auth/register` - Dentista aguarda aprovação
- `POST /api/auth/login` - Retorna accessToken (15m) + refreshToken (7d)
- `POST /api/auth/refresh` - Renova access token
- `POST /api/auth/forgot-password` - Envia link por email
- `POST /api/auth/reset-password` - Reseta senha com token
- `GET /api/auth/me` - Perfil do usuário autenticado (protegido)
- `POST /api/auth/logout` - Confirmação (JWT stateless)

**Fluxo:**
1. Frontend recebe `accessToken` + `refreshToken` + `pendingPushes` no login
2. AccessToken tem validade 15min
3. RefreshToken tem validade 7d (em httpOnly cookie)
4. Quando accessToken expira, frontend chama `/refresh` automaticamente
5. Dentista + LAB_TECH aguardam aprovação do ADMIN para ativar conta

### 3. Cases - CRUD + Pipeline COMPLETO
**Arquivo:** `packages/backend/src/modules/cases/case.routes.ts`

Endpoints:
- `GET /api/cases` - Lista com filtro por role/status/search (paginado)
- `GET /api/cases/:id` - Detalhes completo com timeline
- `POST /api/cases` - Cria novo caso (DENTIST only)
- `PATCH /api/cases/:id` - Edita caso
- `POST /api/cases/:id/submit` - Submete para análise → Dispara `onCaseSubmitted`
- `POST /api/cases/:id/approve` - Dentista aprova planejamento → Dispara `onCaseApproved`
- `POST /api/cases/:id/request-revision` - Pede revisão do planejamento
- `POST /api/cases/:id/status` - Admin/Lab altera status (IN_PLANNING, SHIPPED, etc)
- `POST /api/cases/:id/request-refinement` - Dentista solicita refinamento em caso concluído

**Status pipeline:**
DRAFT → SUBMITTED → IN_PLANNING → WAITING_APPROVAL → APPROVED → IN_PRODUCTION → SHIPPED → COMPLETED (ou REFINEMENT)

**Integrações automáticas:**
- Cada status mudança cria registro em `CaseActivity` e dispara e-mail correspondente
- Seller vinculado ao dentista recebe e-mail em submissões
- Timeline com 50 últimas atividades por caso

---

## 📋 Próximos Passos (FRONTEND)

### Phase 1: Auth Flow
- [ ] Login form com email/pwd
- [ ] Register form (roles: DENTIST, SELLER)
- [ ] Store tokens em localStorage (access) + httpOnly cookie (refresh via header)
- [ ] Auto-refresh token a cada 14min
- [ ] Protected routes por role
- [ ] Redirect to login se unauthorized

### Phase 2: Dashboard by Role
- [ ] DENTIST: Meus casos, submeter novo, pagar
- [ ] LAB_TECH: Casos em planejamento, atualizar status
- [ ] ADMIN: Todos os casos, usuários, regras
- [ ] FINANCIAL: Casos aprovados, faturamento
- [ ] SELLER: Carteira de clientes, notificações

### Phase 3: Forms & Upload
- [ ] Formulário de novo caso com validações
- [ ] Drag & drop de documentos (STL, fotos, RX)
- [ ] Preview de uploads
- [ ] Integração com S3

### Phase 4: Timeline & Details
- [ ] Timeline de atividades por caso
- [ ] Exibição de planning/production/rastreamento
- [ ] Modal de aprovação com setup
- [ ] Integração de push notifications

---

## 🧪 Como Testar

### Auth
```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Dr Silva","email":"silva@clinic.com","password":"Senha@1234","role":"DENTIST"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@estheticaligner.com.br","password":"Admin@123"}'

# Resultado: { accessToken, refreshToken, user, pendingPushes }

# Refresh
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

### Cases
```bash
# Create
curl -X POST http://localhost:3001/api/cases \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patientName":"João Silva","gender":"M","notes":"Bio-compatível"}'

# Submit (dispara email)
curl -X POST http://localhost:3001/api/cases/CASE_ID/submit \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Change Status
curl -X POST http://localhost:3001/api/cases/CASE_ID/status \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"IN_PLANNING"}'
```

---

## 📊 Checklist DoD

- [x] Todos os eventos disparam e-mails corretos
- [x] EventMailer com templates branded
- [x] Auth com JWT (access + refresh)
- [x] Refresh token 7d, access 15m
- [x] Cases com CRUD completo
- [x] Pipeline de status automático
- [x] Timeline de atividades
- [x] Seller integrado em submissão
- [x] Roles validados em endpoints
- [x] Logout endpoint

---

**Status:** ✅ Backend 30% Completo (Auth + Events + Cases planificados)  
**Próximo:** Frontend Login + Dashboard
