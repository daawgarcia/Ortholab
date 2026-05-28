# INSTALAÇÃO DO WAHA NA HOSTINGER VPS

## 🚀 Passo a Passo

### 1. Acesse sua VPS Hostinger

Via SSH:
```bash
ssh root@IP_DA_SUA_VPS
```

### 2. Baixe e execute o script

```bash
# Baixar script
curl -O https://raw.githubusercontent.com/seu-repo/install-waha.sh

# Ou crie o arquivo manualmente e cole o conteúdo
nano install-waha.sh
# Cole o conteúdo do script

# Dar permissão e executar
chmod +x install-waha.sh
sudo bash install-waha.sh
```

### 3. Aguarde a instalação

O script vai:
- ✅ Atualizar o sistema
- ✅ Instalar Docker
- ✅ Configurar firewall
- ✅ Instalar WAHA
- ✅ Configurar backups automáticos
- ✅ Configurar monitoramento

**Tempo estimado:** 3-5 minutos

### 4. Acesse o WAHA

Abra no navegador:
```
http://IP_DA_SUA_VPS:3000
```

### 5. Conecte o WhatsApp

1. Clique em **"Start Session"** ou **"Scan QR"**
2. Abra o WhatsApp no celular
3. Vá em: **Configurações** → **Aparelhos Conectados** → **Conectar Aparelho**
4. Escaneie o QR Code
5. Pronto! ✅

---

## ⚙️ Configurar no Ortholab

No arquivo `.env` do backend:

```env
WAHA_API_URL=http://IP_DA_SUA_VPS_HOSTINGER:3000
WAHA_SESSION_NAME=ortholab
```

Exemplo:
```env
WAHA_API_URL=http://123.456.789.012:3000
WAHA_SESSION_NAME=ortholab
```

---

## 🔧 Comandos Úteis

### Ver logs do WAHA
```bash
docker logs waha -f
```

### Reiniciar WAHA
```bash
cd /opt/waha && docker-compose restart
```

### Verificar status
```bash
docker ps
```

### Fazer backup manual
```bash
/opt/waha/backup.sh
```

### Atualizar WAHA
```bash
cd /opt/waha
docker-compose pull
docker-compose up -d
```

---

## 🛡️ Firewall Hostinger

No painel da Hostinger, verifique se a **porta 3000** está liberada:

1. Acesse: **Painel Hostinger** → **VPS** → **Firewall**
2. Adicione regra:
   - **Porta:** 3000
   - **Protocolo:** TCP
   - **Ação:** Allow

Ou via comando (já feito pelo script):
```bash
ufw allow 3000/tcp
```

---

## 📊 Monitoramento

O script já configura:
- ✅ **Health check** a cada 5 minutos
- ✅ **Backup diário** às 2h da manhã
- ✅ **Reinício automático** se travar

### Ver logs de saúde
```bash
cat /opt/waha/logs/health.log
```

### Ver backups
```bash
ls -la /opt/waha/backups/
```

---

## 🔄 Manter Sessão Ativa

**IMPORTANTE:** O celular precisa ficar:
- 🔋 Carregado
- 📶 Com internet (WiFi ou 4G)
- 📱 WhatsApp aberto ocasionalmente

Se o celular ficar offline, o WAHA desconecta!

---

## 🆘 Problemas Comuns

### "Não consigo acessar :3000"
```bash
# Verificar se está rodando
docker ps

# Verificar firewall
ufw status

# Ver logs
docker logs waha
```

### "Sessão caiu sozinha"
- Verifique se o celular está online
- Reinicie o WAHA: `cd /opt/waha && docker-compose restart`
- Escanee o QR Code novamente

### "Mensagens não estão enviando"
```bash
# Verificar status da sessão
curl http://localhost:3000/api/ortholab/status

# Reiniciar se necessário
cd /opt/waha && docker-compose restart
```

---

## 📞 Suporte

- **WAHA Docs:** https://waha.devlike.pro/
- **Hostinger Support:** https://www.hostinger.com.br/tutoriais

---

## ✅ Checklist Pós-Instalação

- [ ] Script executado sem erros
- [ ] Acesso http://IP:3000 funcionando
- [ ] QR Code escaneado
- [ ] Status mostra "CONNECTED"
- [ ] Teste de mensagem enviado
- [ ] Configuração no Ortholab (.env)
- [ ] Teste de envio pelo Ortholab

---

**Pronto! Seu WAHA está configurado na Hostinger! 🎉**
