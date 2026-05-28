# CONFIGURAÇÃO DO GITHUB ACTIONS

## 🚀 O que foi criado:

Arquivo `.github/workflows/deploy.yml` que:
1. ✅ Roda migrations do Prisma
2. ✅ Faz build do backend
3. ✅ Deploy no Render (automático)
4. ✅ Deploy no Vercel (automático)
5. ✅ Notifica sucesso/falha

---

## ⚙️ Configuração necessária no GitHub:

### Passo 1: Acesse as Settings do Repositório

1. Vá em: https://github.com/daawgarcia/Ortholab/settings/secrets/actions
2. Clique em **"New repository secret"**

---

### Passo 2: Adicione os Secrets

#### Secret 1: `DATABASE_URL`
```
Name: DATABASE_URL
Value: (sua URL do banco de dados PostgreSQL)
```

#### Secret 2: `RENDER_DEPLOY_HOOK`
Para pegar o Deploy Hook:
1. Acesse: https://dashboard.render.com/web/srv-d6vhtfffte5s73dstkgg
2. Vá em **Settings**
3. Copie o **Deploy Hook URL**
4. Cole no GitHub

```
Name: RENDER_DEPLOY_HOOK
Value: https://api.render.com/deploy/srv-xxxxxxxxxx?key=xxxxxxxxx
```

#### Secret 3: `VERCEL_TOKEN`
Para pegar o token:
1. Acesse: https://vercel.com/account/tokens
2. Clique em **"Create Token"**
3. Copie o token
4. Cole no GitHub

```
Name: VERCEL_TOKEN
Value: (seu token do Vercel)
```

#### Secret 4: `VERCEL_ORG_ID`
1. No projeto Vercel, vá em **Settings** → **General**
2. Copie o **Organization ID**

```
Name: VERCEL_ORG_ID
Value: (seu org ID)
```

#### Secret 5: `VERCEL_PROJECT_ID`
1. No projeto Vercel, vá em **Settings** → **General**
2. Copie o **Project ID**

```
Name: VERCEL_PROJECT_ID
Value: (seu project ID)
```

---

### Passo 3: Commit e Push

```bash
git add .
git commit -m "feat: add GitHub Actions for auto deploy"
git push origin main
```

---

## 🎉 Pronto!

Agora toda vez que você fizer `git push`, o deploy acontece automaticamente!

---

## 📊 Acompanhar Deploy

Acesse a aba **Actions** no GitHub:
https://github.com/daawgarcia/Ortholab/actions

Lá você vê:
- Status do deploy em tempo real
- Logs de cada etapa
- Histórico de deploys

---

## 🔄 Fluxo de Trabalho

1. Você faz alterações no código
2. Commit e push: `git push origin main`
3. GitHub Actions detecta automaticamente
4. Roda migrations
5. Deploy backend no Render
6. Deploy frontend no Vercel
7. ✅ Pronto!

---

## 🆘 Troubleshooting

### "Deploy falhou"
Verifique os logs em: https://github.com/daawgarcia/Ortholab/actions

### "Migrations falharam"
Verifique se `DATABASE_URL` está correto nos secrets

### "Render não recebeu deploy"
Verifique se `RENDER_DEPLOY_HOOK` está correto

---

**Quer que eu te ajude a pegar algum desses valores?** 🚀
