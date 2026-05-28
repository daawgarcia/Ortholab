# GUIA DE DEPLOY DO ORTHOLAB

## 📋 Checklist Pré-Deploy

### 1. Banco de Dados (Migrations)

```bash
# No diretório packages/backend
npx prisma migrate dev --name add_all_new_features

# Ou deploy direto (produção)
npx prisma migrate deploy
```

**Migrations necessárias:**
- ✅ Model `Entry` (Entradas do workflow)
- ✅ Model `CaseApprovalVideo` (Vídeos de aprovação)
- ✅ Model `CaseApprovalDocument` (PDFs de aprovação)
- ✅ Enum `EXPEDITION` (Novo role)
- ✅ Enum `ApprovalVideoStatus` e `ApprovalDocStatus`

---

### 2. Variáveis de Ambiente

No arquivo `.env` do backend, adicione:

```env
# WAHA - WhatsApp API
WAHA_API_URL=http://187.127.28.216:3001
WAHA_SESSION_NAME=ortholab

# LinkTrack (Rastreio Correios) - Opcional
LINKETRACK_USER=seu_usuario
LINKETRACK_TOKEN=seu_token

# Frontend URL
FRONTEND_URL=https://ortholab-frontend.vercel.app
```

---

### 3. Deploy Backend (Render/Railway)

#### Opção A: Render

1. Acesse: https://dashboard.render.com
2. Crie novo **Web Service**
3. Conecte o repositório GitHub
4. Configure:
   - **Build Command:** `npm install && npx prisma generate && npm run build`
   - **Start Command:** `npm start`
   - **Root Directory:** `packages/backend`
5. Adicione as **Environment Variables**
6. Deploy!

#### Opção B: Railway

1. Acesse: https://railway.app
2. Crie novo projeto
3. Deploy from GitHub repo
4. Configure as variáveis de ambiente
5. Deploy!

---

### 4. Deploy Frontend (Vercel)

1. Acesse: https://vercel.com
2. Importe o projeto do GitHub
3. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `packages/frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Adicione **Environment Variables**:
   ```env
   VITE_API_URL=https://seu-backend.onrender.com
   ```
5. Deploy!

---

### 5. Verificar WAHA na Hostinger

Conecte na VPS e verifique:

```bash
ssh root@187.127.28.216

# Verificar se WAHA está rodando
docker ps

# Ver logs
docker logs waha-ortholab -f

# Se necessário, reiniciar
docker restart waha-ortholab
```

Acesse: http://187.127.28.216:3001

---

## 🧪 Testes Pós-Deploy

### Teste 1: Coluna Entradas
1. Acesse: `/workflow/entries`
2. Verifique se a tabela carrega
3. Teste criar caixa e iniciar workflow

### Teste 2: Upload de Vídeo/PDF
1. Acesse um caso
2. Faça upload de vídeo de aprovação
3. Verifique se dentista recebe notificação

### Teste 3: WhatsApp
1. Acesse: `/admin/whatsapp`
2. Verifique status da conexão
3. Envie mensagem de teste

### Teste 4: Expedição
1. Acesse: `/workflow/expedition`
2. Registre postagem com código de rastreio
3. Verifique se dentista recebe WhatsApp

### Teste 5: Relatórios
1. Acesse: `/admin/reports`
2. Verifique dados de casos enviados
3. Exporte CSV

---

## 🚨 Troubleshooting

### Erro: "Cannot find module"
```bash
npm install
npx prisma generate
```

### Erro: "Database migration failed"
```bash
npx prisma migrate reset  # CUIDADO: Apaga dados!
# Ou
npx prisma migrate resolve --applied 20250127120000_nome_migration
```

### Erro: "WAHA não conecta"
- Verifique se porta 3001 está liberada no firewall
- Verifique se container está rodando: `docker ps`
- Reinicie: `docker restart waha-ortholab`

### Erro: "CORS"
- Verifique se `FRONTEND_URL` está configurado corretamente no backend
- Adicione a URL do frontend nas origens permitidas

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do backend
2. Verifique os logs do WAHA
3. Verifique console do navegador
4. Me envie o erro específico

---

## ✅ Checklist Final

- [ ] Migrations rodadas com sucesso
- [ ] Backend deployado e rodando
- [ ] Frontend deployado e acessível
- [ ] WAHA conectado e funcionando
- [ ] Teste de criação de entrada OK
- [ ] Teste de upload de vídeo OK
- [ ] Teste de WhatsApp OK
- [ ] Teste de expedição com rastreio OK
- [ ] Teste de relatórios OK

**Bom deploy! 🚀**
