# HOSPEDAGEM DO WAHA - 100% UPTIME

## 🎯 Objetivo
Manter o WAHA (WhatsApp API) rodando 24/7 de forma estável.

---

## 🏆 Opção Recomendada: VPS/Cloud Server

### Por que não usar o mesmo servidor do Ortholab?

❌ **Não recomendado** rodar no mesmo servidor da aplicação porque:
- Se o Ortholab reiniciar, o WhatsApp cai
- Alto consumo de memória (WhatsApp + Chrome)
- Dificuldade de manter sessão ativa

✅ **Recomendado** servidor dedicado para WAHA

---

## 💻 Opções de Hospedagem

### 1. VPS Barato (Recomendado para iniciar)

| Provedor | Plano | Preço | Especificações |
|----------|-------|-------|----------------|
| **Contabo** | VPS S | ~$6/mês | 4 vCPU, 8GB RAM, 200GB SSD |
| **Hetzner** | CPX11 | ~$6/mês | 2 vCPU, 4GB RAM, 40GB NVMe |
| **DigitalOcean** | Basic | ~$12/mês | 2 vCPU, 4GB RAM, 80GB SSD |
| **AWS Lightsail** | $10 | ~$10/mês | 2 vCPU, 4GB RAM, 80GB SSD |

**Recomendação:** Contabo ou Hetzner (melhor custo-benefício)

---

### 2. Configuração do Servidor WAHA

#### Requisitos Mínimos:
- **SO:** Ubuntu 22.04 LTS
- **RAM:** 4GB (mínimo)
- **CPU:** 2 vCPU
- **Disco:** 40GB SSD
- **Rede:** Porta 3000 liberada

#### Instalação:

```bash
# 1. Atualizar sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 3. Criar pasta para dados
mkdir -p ~/waha-data

# 4. Rodar WAHA com Docker
docker run -d \
  --name waha \
  --restart unless-stopped \
  -p 3000:3000 \
  -v ~/waha-data/.sessions:/app/.sessions \
  -e WAHA_SESSION_NAME=ortholab \
  -e WAHA_PORT=3000 \
  devlikeapro/waha:latest

# 5. Verificar se está rodando
docker ps
docker logs waha -f
```

---

### 3. Configurar Domínio (Opcional mas recomendado)

```bash
# Instalar Nginx
sudo apt install nginx -y

# Configurar proxy reverso
sudo tee /etc/nginx/sites-available/waha << 'EOF'
server {
    listen 80;
    server_name waha.seudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/waha /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Instalar SSL (Certbot)
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d waha.seudominio.com
```

---

### 4. Configurar no Ortholab

No `.env` do backend:

```env
# WAHA - WhatsApp API
WAHA_API_URL=http://IP_DO_SERVIDOR_WAHA:3000
# ou se usar domínio:
# WAHA_API_URL=https://waha.seudominio.com

WAHA_SESSION_NAME=ortholab
```

---

## 🔒 Segurança Importante

### 1. Firewall
```bash
# Liberar apenas porta 3000 para IP do Ortholab
sudo ufw allow from IP_DO_ORTHOLAB to any port 3000
sudo ufw enable
```

### 2. Autenticação (opcional)
O WAHA não tem auth nativa. Você pode:
- Usar VPN entre servidores
- Configurar Basic Auth no Nginx
- Usar API Key no header

---

## 📊 Monitoramento

### Script de Health Check

```bash
# Criar script
cat > ~/check-waha.sh << 'EOF'
#!/bin/bash
if ! docker ps | grep -q waha; then
    echo "$(date): WAHA parado, reiniciando..." >> ~/waha-restarts.log
    docker start waha
fi
EOF

chmod +x ~/check-waha.sh

# Adicionar ao crontab (verificar a cada 5 minutos)
crontab -e
# Adicionar:
*/5 * * * * ~/check-waha.sh
```

---

## 🔄 Backup da Sessão

A sessão do WhatsApp fica em `~/waha-data/.sessions`. Faça backup:

```bash
# Backup diário
0 2 * * * tar -czf ~/backups/waha-$(date +\%Y\%m\%d).tar.gz ~/waha-data/.sessions
```

---

## ⚠️ Cuidados Importantes

1. **Celular deve ficar ONLINE**
   - Se o celular ficar sem internet, o WAHA desconecta
   - Mantenha o celular carregado e com internet

2. **Não use WhatsApp Business API**
   - Use WhatsApp normal ou Business (app)
   - WAHA usa o app normal via web

3. **Evite banimento**
   - Não envie spam
   - Respeite limites de envio
   - Use mensagens personalizadas

4. **Sessão única**
   - Um número = uma sessão
   - Se conectar em outro lugar, a sessão cai

---

## 🚀 Resumo da Arquitetura

```
┌─────────────────┐         ┌─────────────────┐
│  Ortholab App   │────────▶│   WAHA Server   │
│   (Render/AWS)  │  HTTPS  │   (VPS/Cloud)   │
└─────────────────┘         └────────┬────────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │   WhatsApp   │
                              │   (Celular)  │
                              └──────────────┘
```

---

## 💰 Custo Estimado

| Componente | Custo Mensal |
|------------|--------------|
| VPS para WAHA | $6 - $12 |
| Dominio (opcional) | $1 - $2 |
| **Total** | **~$8 - $14/mês** |

---

## ✅ Checklist de Instalação

- [ ] Contratar VPS (Contabo/Hetzner)
- [ ] Instalar Ubuntu 22.04
- [ ] Instalar Docker
- [ ] Rodar container WAHA
- [ ] Configurar firewall
- [ ] Configurar domínio (opcional)
- [ ] Configurar SSL (opcional)
- [ ] Configurar Ortholab (.env)
- [ ] Escanear QR Code
- [ ] Testar envio de mensagem
- [ ] Configurar monitoramento
- [ ] Configurar backup

---

## 📞 Suporte WAHA

Documentação: https://waha.devlike.pro/
GitHub: https://github.com/devlikeapro/waha

---

**Quer que eu crie um script de instalação automática?**
