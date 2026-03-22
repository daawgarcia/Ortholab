# 🚀 Deploy Ortholab 2026 - Guia Completo

## Opção 1: Deploy Automático com Render (RECOMENDADO)

Render é **GRATUITO** e muito mais simples que Railway. Aqui está o passo-a-passo:

### 1️⃣ Backend + Banco + Frontend (Tudo em 1 lugar)

#### I. Conectar GitHub ao Render

1. Acesse [https://dashboard.render.com](https://dashboard.render.com)
2. Clique em **"New +"** → **"Blueprint"**
3. Selecione seu repositório GitHub do Ortholab
4. Render vai detectar automaticamente o `render.yaml`

#### II. Configurar Variáveis de Ambiente

Render vai pedir para preencher as variáveis. As obrigatórias são:

| Variável | Valor Exemplo |
|----------|---------------|
| `JWT_SECRET` | `seu-secret-secreto-super-longo-minimo-32-chars` |
| `JWT_REFRESH_SECRET` | `outro-secret-super-secreto-minimo-32-chars` |
| `SMTP_HOST` | `smtp.gmail.com` (ou seu provider) |
| `SMTP_USER` | `seu-email@gmail.com` |
| `SMTP_PASS` | `sua-senha-app-gmail` |
| `S3_ACCESS_KEY` | Sua chave AWS ou MinIO |
| `S3_SECRET_KEY` | Sua secret AWS ou MinIO |

#### III. Deploy

1. Clique em **"Deploy"**
2. Render vai:
   - ✅ Instalar dependências
   - ✅ Criar banco PostgreSQL
   - ✅ Fazer migrations automáticas
   - ✅ Compilar backend
   - ✅ Fazer build frontend
   - ✅ Rodar servidor

**Tempo:** ~5-10 minutos

#### IV. Resultado

- Backend: `https://ortholab-backend.onrender.com` 
- Frontend: `https://ortholab-frontend.onrender.com`
- Banco: PostgreSQL gerenciado automaticamente

---

## Opção 2: Deploy Manual (Step-by-Step)

### Backend no Render

1. Acesse [https://dashboard.render.com](https://dashboard.render.com)
2. **New Web Service**
3. Conecte seu repositório GitHub
4. **Configure:**
   - **Name:** `ortholab-backend`
   - **Root Directory:** `packages/backend`
   - **Build Command:** `npm install && npm run db:generate && npm run build`
   - **Start Command:** `npm run db:migrate && node dist/server.js`
   - **Plan:** Free (ou Starter se quiser mais)
   - **Environment:** Node

5. **Add Environment Variables:**
   - `DATABASE_URL=` (Render preenche automaticamente se você criar um serviço PostgreSQL)
   - `JWT_SECRET=` (seu valor)
   - `JWT_REFRESH_SECRET=` (seu valor)
   - `FRONTEND_URL=`https://seu-frontend.onrender.com`
   - Outras (SMTP, S3, etc.)

6. **Create Web Service** → Deploy começa automaticamente

### Banco de Dados (PostgreSQL)

1. No Render, clique **New** → **PostgreSQL**
2. **Name:** `ortholab-postgres`
3. **Plan:** Free
4. Depois de criar, copie a `DATABASE_URL` (connection string) e adicione ao backend

### Frontend no Render (ou Vercel)

#### Opção A: Vercel (RECOMENDADO para Frontend)

1. Acesse [https://vercel.com](https://vercel.com)
2. **Add New** → **Project**
3. Selecione seu repositório GitHub
4. **Framework Preset:** Vite
5. **Root Directory:** `packages/frontend`
6. **Build Command:** `npm run build`
7. **Output Directory:** `dist`
8. **Environment Variables:**
   - `VITE_API_URL=` (URL do seu backend no Render)
9. **Deploy**

#### Opção B: Render (Static Site)

1. No Render, **New Static Site**
2. Conecte repositório
3. **Build Command:** `cd packages/frontend && npm install && npm run build`
4. **Publish Directory:** `packages/frontend/dist`
5. **Deploy**

---

## 📋 Checklist Pré-Deploy

Antes de fazer deploy, garanta que:

- [ ] `.env` local está configurado (para testes)
- [ ] Backend compila: `npm run build --workspace=packages/backend`
- [ ] Frontend compila: `npm run build --workspace=packages/frontend`
- [ ] Todas as variáveis de ambiente estão prontas
- [ ] GitHub branch main está atualizado

---

## 🔑 Variáveis de Ambiente - Guia Completo

### Obrigatórias

```env
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=seu-secret-super-secreto-minimo-32-caracteres
JWT_REFRESH_SECRET=outro-secret-super-secreto-minimo-32
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://seu-frontend.onrender.com
APP_URL=https://seu-frontend.onrender.com
```

### Email (Recomendado)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app  # Google App Password (2FA)
SMTP_FROM=noreply@estheticaligner.com.br
```

**Nota:** Se usar Gmail:
1. Ative 2FA em sua conta
2. Gere uma [App Password](https://myaccount.google.com/apppasswords)
3. Use a senha gerada

### S3 / Armazenamento (Opcional para MVP)

```env
S3_ENDPOINT=s3.amazonaws.com  # ou seu MinIO
S3_ACCESS_KEY=sua-chave-aws
S3_SECRET_KEY=sua-secret-aws
S3_BUCKET=ortholab-files
```

Se não quiser S3 agora:
- Use MinIO local em desenvolvimento
- Em produção, ative quando precisar de uploads

---

## ✅ Após o Deploy

### Testes Rápidos

1. **Backend Health Check:**
```bash
curl https://seu-backend.onrender.com/health
```

2. **Login:**
```bash
curl -X POST https://seu-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@estheticaligner.com.br","password":"Admin@123"}'
```

3. **Acessar Frontend:**
   - https://seu-frontend.onrender.com
   - Login com admin@estheticaligner.com.br / Admin@123

### Monitorar Logs

No Render:
- Backend: Dashboard → Service → Logs
- PostgreSQL: Dashboard → Database → Logs
- Frontend: Dashboard → Service → Logs

### Atualizações Futuras

Toda vez que você fazer `git push` para `main`:
1. Render detecta automaticamente
2. Reconstrói e redeploy
3. Zero downtime em geral

---

## 🐛 Troubleshooting

### Erro: `DATABASE_URL not found`
- Criar um serviço PostgreSQL no Render
- Copiar a connection string
- Adicionar como variável de ambiente

### Erro: `EMAIL_NOT_CONFIGURED`
- Adicionar `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
- Ou desativar e-mails em prod por enquanto

### Erro: `Build failed - npm ERR!`
- Verificar se `package.json` tem script `build`
- Verifar se todas as dependências estão em `package.json`
- Rodar `npm install` localmente e testar compilação

### Erro: `Service startup timeout`
- Aumentar o start command timeout em deploy settings
- Verifar se variáveis de ambiente estão todas preenchidas
- Ver logs para erro específico

### Frontend mostra "Cannot GET /"
- Verificar se `VITE_API_URL` está correto no Render
- Verificar se frontend foi buildado corretamente (`dist/index.html` existe?)
- Verifar se deploy aponta para a pasta `dist` correta

---

## 📊 Custos Esperados

| Serviço | Render Free | Custo |
|---------|-------------|-------|
| Backend | ✅ | $0 |
| PostgreSQL | ✅ (0.5GB) | $0 |
| Frontend | ✅ | $0 |
| Redis | ✅ (25MB) | $0 |
| **TOTAL** | | **$0** 🎉 |

**Nota:** Render coloca apps em sleep após 15min de inatividade. Para production 24/7, upgrade para Starter ($7/mês)

---

## 🚀 Próximas Etapas

Após deploy estar funcionando:

1. **Testar fluxo completo:**
   - Login
   - Criar caso
   - Submit e validar e-mail
   - Aprovar e mudançar status

2. **Payment Integration:**
   - Integrar Rede adquirente
   - Integrar Saúde Service

3. **Otimizações:**
   - CDN para frontend (CloudFlare)
   - Cache GraphQL/Redis
   - Monitoring (Sentry, DataDog)

---

## 📞 Support

Se tiver dúvida:
- [Render Docs](https://render.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app) (alternativa)

---

**Status:** 🟢 Pronto para Deploy!

Bora lá? 🚀
