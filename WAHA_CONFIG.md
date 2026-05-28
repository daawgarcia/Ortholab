# CONFIGURAÇÃO DO WAHA - WHATSAPP API

## 📋 Visão Geral

O sistema Ortholab agora possui integração com WhatsApp via **WAHA** (WhatsApp HTTP API).

**Funcionalidade:** Envio automático de mensagens quando um caso vai para aprovação.

---

## 🚀 Como Configurar

### 1. Instalar o WAHA

O WAHA precisa estar rodando em um servidor. Você tem 2 opções:

#### Opção A: Docker (Recomendado)

```bash
# Rodar WAHA via Docker
docker run -d \
  --name waha \
  -p 3000:3000 \
  -v `pwd`/.sessions:/app/.sessions \
  devlikeapro/waha:latest
```

#### Opção B: Instalação Manual

Siga a documentação oficial: https://waha.devlike.pro/docs/overview/

---

### 2. Configurar Variáveis de Ambiente

No arquivo `.env` do backend, adicione:

```env
# WAHA - WhatsApp API
WAHA_API_URL=http://localhost:3000
WAHA_SESSION_NAME=ortholab
```

Se o WAHA estiver em outro servidor:
```env
WAHA_API_URL=http://IP_DO_SERVIDOR:3000
WAHA_SESSION_NAME=ortholab
```

---

### 3. Conectar o WhatsApp

#### Passo 1: Iniciar Sessão

Acesse o painel admin do Ortholab ou use a API:

```bash
curl -X POST https://seu-backend.com/api/whatsapp/start \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN"
```

Ou via painel:
1. Acesse: **Admin** → **WhatsApp**
2. Clique em **"Iniciar Sessão"**

#### Passo 2: Escanear QR Code

1. Acesse: `http://IP_DO_WAHA:3000`
2. Você verá um **QR Code**
3. Abra o WhatsApp no celular
4. Vá em: **Configurações** → **Aparelhos Conectados** → **Conectar Aparelho**
5. Escaneie o QR Code

#### Passo 3: Verificar Conexão

```bash
curl https://seu-backend.com/api/whatsapp/status \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN"
```

Deve retornar:
```json
{
  "connected": true,
  "session": "ortholab",
  "timestamp": "2025-01-27T..."
}
```

---

## 📱 Fluxo de Mensagens

### Quando um caso vai para aprovação:

1. **Movimentador** sobe vídeo/PDF
2. Sistema envia automaticamente:
   - ✅ Push Notification
   - ✅ Email
   - ✅ **WhatsApp** (novo!)

### Exemplo da mensagem:

```
Olá, Dr(a). João Silva! 👋

O caso #000123 - Maria Santos está pronto e aguardando sua aprovação. 🎬

Acesse a plataforma para visualizar o vídeo e aprovar o caso:
https://ortholab-frontend.vercel.app

Ortholab - Esthetic Aligner
```

---

## 🔧 Endpoints da API

### Verificar Status
```
GET /api/whatsapp/status
```

### Iniciar Sessão
```
POST /api/whatsapp/start
```

### Parar Sessão
```
POST /api/whatsapp/stop
```

### Enviar Mensagem de Teste
```
POST /api/whatsapp/test
{
  "phone": "5511999999999",
  "message": "Teste de mensagem"
}
```

### Enviar Notificação de Aprovação
```
POST /api/whatsapp/send-approval
{
  "phone": "5511999999999",
  "dentistName": "João Silva",
  "caseNumber": 123,
  "patientName": "Maria Santos"
}
```

---

## ⚠️ Importante

1. **O número não responde mensagens** - É apenas para envio
2. **O celular precisa ficar online** - Se o celular ficar sem internet, o WAHA para de funcionar
3. **Não use WhatsApp Business API** - Use o WAHA com WhatsApp normal
4. **Mensagens são enviadas apenas uma vez** - Se falhar, não há retry automático

---

## 🐛 Troubleshooting

### "Sessão não está ativa"
- Verifique se o WAHA está rodando: `docker ps`
- Verifique se o celular está online
- Reinicie a sessão: `POST /api/whatsapp/start`

### "Erro ao enviar mensagem"
- Verifique se o número está correto (com código do país)
- Verifique se o número está cadastrado no WhatsApp
- Verifique logs do WAHA: `docker logs waha`

### "QR Code não aparece"
- Limpe a sessão: `docker rm -f waha`
- Recrie o container
- Acesse diretamente: `http://IP:3000`

---

## 📞 Suporte

Documentação oficial do WAHA:
https://waha.devlike.pro/

---

## ✅ Checklist de Instalação

- [ ] WAHA instalado e rodando
- [ ] Variáveis de ambiente configuradas
- [ ] Sessão iniciada no Ortholab
- [ ] QR Code escaneado
- [ ] Status mostra "connected": true
- [ ] Teste de mensagem enviado com sucesso
- [ ] Fluxo de aprovação testado
