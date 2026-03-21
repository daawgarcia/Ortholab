# Deploy Ortholab — Hostinger VPS (teste) → AWS (produção)

## Estrutura de arquivos no seu computador

```
C:\Users\otavi\.verdent\verdent-projects\Ortholab_2026\
├── package.json                  ← raiz do monorepo
├── docker-compose.yml            ← PostgreSQL + MinIO + Redis
├── .env.example                  ← copiar para .env e preencher
├── .gitignore
└── packages/
    ├── backend/                  ← API Node.js + Fastify
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── prisma/
    │   │   ├── schema.prisma     ← schema do banco
    │   │   └── seed.ts           ← dados iniciais
    │   └── src/
    │       ├── server.ts
    │       ├── plugins/          ← prisma, s3, mailer, auth
    │       └── modules/          ← auth, cases, planning, financial...
    └── frontend/                 ← React + Vite + Tailwind
        ├── package.json
        ├── vite.config.ts
        ├── tailwind.config.js
        ├── index.html
        └── src/
            ├── main.tsx
            ├── App.tsx
            ├── index.css
            ├── lib/              ← api.ts, utils.ts
            ├── store/            ← auth.ts (Zustand)
            ├── components/       ← layout, ui, shared
            ├── hooks/            ← use-toast.ts
            └── pages/            ← auth, dashboard, cases, planning...
```

---

## PASSO 1 — Instalar pré-requisitos (seu Windows)

1. **Node.js 20+**: https://nodejs.org/en/download (versão LTS)
2. **Docker Desktop**: https://www.docker.com/products/docker-desktop
3. Abrir o PowerShell na pasta do projeto e rodar:

```powershell
cd "C:\Users\otavi\.verdent\verdent-projects\Ortholab_2026"
npm install
```

---

## PASSO 2 — Configurar ambiente local

```powershell
# Copiar o .env.example para .env
Copy-Item .env.example .env
```

Edite o `.env` e preencha pelo menos:
- `DATABASE_URL` (já está correto para o Docker local)
- `JWT_SECRET` e `JWT_REFRESH_SECRET` (qualquer string longa aleatória)
- `SMTP_*` (use Mailtrap para testes: https://mailtrap.io)

---

## PASSO 3 — Subir banco de dados local (Docker)

```powershell
docker-compose up -d
```

Aguarde ~10 segundos e depois:

```powershell
cd packages/backend
npm run db:migrate
npm run db:seed
```

Isso cria todas as tabelas e o usuário admin:
- **E-mail**: admin@estheticaligner.com.br
- **Senha**: Admin@123

---

## PASSO 4 — Rodar localmente

```powershell
# Terminal 1 — Backend
cd "C:\Users\otavi\.verdent\verdent-projects\Ortholab_2026\packages\backend"
npm run dev

# Terminal 2 — Frontend
cd "C:\Users\otavi\.verdent\verdent-projects\Ortholab_2026\packages\frontend"
npm run dev
```

Acesse: http://localhost:5173

---

## PASSO 5 — Deploy na Hostinger VPS (teste)

### O que você precisa na Hostinger:
- VPS com Ubuntu 22.04
- Mínimo 2GB RAM, 2 vCPU (plano KVM 2 é suficiente para testes)
- Domínio apontado: `ortholab.estheticaligner.com.br`

### Configuração no servidor Hostinger:

```bash
# 1. Instalar Docker e Node.js
curl -fsSL https://get.docker.com | sh
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 2. Instalar Nginx e Certbot (SSL grátis)
apt install -y nginx certbot python3-certbot-nginx

# 3. Clonar o projeto (via Git ou SFTP)
git clone https://github.com/SEU_USUARIO/ortholab.git /var/www/ortholab
cd /var/www/ortholab

# 4. Criar .env com as variáveis de produção
cp .env.example .env
nano .env   # preencher todas as variáveis

# 5. Subir banco + MinIO
docker-compose up -d

# 6. Instalar dependências e buildar
npm install
cd packages/backend && npm run db:migrate && npm run db:seed && npm run build
cd ../frontend && npm run build

# 7. Iniciar o backend com PM2
npm install -g pm2
pm2 start "node packages/backend/dist/server.js" --name ortholab-api
pm2 save && pm2 startup
```

### Configurar Nginx:

```nginx
# /etc/nginx/sites-available/ortholab
server {
    server_name ortholab.estheticaligner.com.br;

    # Frontend (arquivos estáticos buildados)
    location / {
        root /var/www/ortholab/packages/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 250M;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/ortholab /etc/nginx/sites-enabled/
certbot --nginx -d ortholab.estheticaligner.com.br
nginx -t && systemctl reload nginx
```

---

## PASSO 6 — Migrar para AWS (produção)

Quando o sistema estiver validado na Hostinger, a migração para AWS envolve apenas trocar os serviços:

| Serviço atual (Hostinger) | Equivalente AWS | Motivo |
|---|---|---|
| PostgreSQL no Docker | **RDS PostgreSQL** | Banco gerenciado, backups automáticos |
| MinIO no Docker | **S3** | Storage nativo AWS, sem manutenção |
| Node.js com PM2 | **EC2** ou **ECS** | Escalabilidade automática |
| Nginx | **ALB (Load Balancer)** | Balanceamento + SSL gerenciado |
| Variáveis `.env` | **Secrets Manager** | Segurança das credenciais |

### Mudanças no `.env` para AWS:
```
DATABASE_URL=postgresql://user:pass@rds-endpoint.amazonaws.com:5432/ortholab
S3_ENDPOINT=           ← remover (usar SDK nativo da AWS)
S3_ACCESS_KEY=         ← usar IAM Role em vez de credenciais fixas
S3_BUCKET=ortholab-prod-files
S3_REGION=sa-east-1    ← São Paulo
```

---

## Resumo dos URLs no sistema em produção

| URL | O que é |
|---|---|
| `ortholab.estheticaligner.com.br` | Portal principal (frontend) |
| `ortholab.estheticaligner.com.br/api` | API backend |
| `ortholab.estheticaligner.com.br:9001` | MinIO console (somente interno) |

---

## Credenciais padrão após seed

| Usuário | E-mail | Senha | Perfil |
|---|---|---|---|
| Admin | admin@estheticaligner.com.br | Admin@123 | ADMIN |

> Troque a senha imediatamente após o primeiro acesso em produção!
