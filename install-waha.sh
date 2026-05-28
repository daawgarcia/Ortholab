#!/bin/bash

# =============================================================================
# SCRIPT DE INSTALAÇÃO AUTOMÁTICA DO WAHA - HOSTINGER VPS
# =============================================================================
# Este script instala e configura o WAHA (WhatsApp API) no seu VPS Hostinger
# Execute como root ou com sudo
# =============================================================================

set -e  # Parar em caso de erro

echo "=========================================="
echo "INSTALAÇÃO DO WAHA - WHATSAPP API"
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# =============================================================================
# VERIFICAÇÕES INICIAIS
# =============================================================================

echo -e "${YELLOW}[1/8] Verificando permissões...${NC}"

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Este script precisa ser executado como root${NC}"
    echo "Use: sudo bash install-waha.sh"
    exit 1
fi

echo -e "${GREEN}✅ Permissões OK${NC}"

# =============================================================================
# ATUALIZAR SISTEMA
# =============================================================================

echo -e "${YELLOW}[2/8] Atualizando sistema...${NC}"

apt-get update -qq
apt-get upgrade -y -qq

echo -e "${GREEN}✅ Sistema atualizado${NC}"

# =============================================================================
# INSTALAR DEPENDÊNCIAS
# =============================================================================

echo -e "${YELLOW}[3/8] Instalando dependências...${NC}"

apt-get install -y -qq \
    curl \
    wget \
    git \
    ufw \
    fail2ban \
    htop \
    nano \
    net-tools

echo -e "${GREEN}✅ Dependências instaladas${NC}"

# =============================================================================
# INSTALAR DOCKER
# =============================================================================

echo -e "${YELLOW}[4/8] Instalando Docker...${NC}"

if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅ Docker já está instalado${NC}"
else
    # Instalar Docker oficial
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    
    # Adicionar usuário ao grupo docker
    usermod -aG docker $SUDO_USER 2>/dev/null || true
    
    # Iniciar Docker
    systemctl start docker
    systemctl enable docker
    
    rm -f get-docker.sh
    
    echo -e "${GREEN}✅ Docker instalado${NC}"
fi

# Instalar Docker Compose
if ! command -v docker-compose &> /dev/null; then
    apt-get install -y -qq docker-compose-plugin || \
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && \
    chmod +x /usr/local/bin/docker-compose
fi

# =============================================================================
# CRIAR ESTRUTURA DE PASTAS
# =============================================================================

echo -e "${YELLOW}[5/8] Criando estrutura de pastas...${NC}"

mkdir -p /opt/waha/data/.sessions
mkdir -p /opt/waha/logs
mkdir -p /opt/waha/backups

cd /opt/waha

echo -e "${GREEN}✅ Pastas criadas em /opt/waha${NC}"

# =============================================================================
# CRIAR DOCKER COMPOSE
# =============================================================================

echo -e "${YELLOW}[6/8] Configurando WAHA...${NC}"

cat > /opt/waha/docker-compose.yml << 'EOF'
version: '3.8'

services:
  waha:
    image: devlikeapro/waha:latest
    container_name: waha
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - WAHA_SESSION_NAME=ortholab
      - WAHA_PORT=3000
      - WAHA_LOG_LEVEL=info
      - WAHA_LOG_FORMAT=json
    volumes:
      - ./data/.sessions:/app/.sessions
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 512M

  # Opcional: Watchtower para atualização automática
  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_POLL_INTERVAL=86400  # Verificar atualizações a cada 24h
    command: waha
EOF

echo -e "${GREEN}✅ Docker Compose configurado${NC}"

# =============================================================================
# CONFIGURAR FIREWALL
# =============================================================================

echo -e "${YELLOW}[7/8] Configurando firewall...${NC}"

# Configurar UFW
ufw default deny incoming
ufw default allow outgoing

# Liberar SSH (para não perder acesso)
ufw allow 22/tcp

# Liberar porta do WAHA
ufw allow 3000/tcp

echo "y" | ufw enable

echo -e "${GREEN}✅ Firewall configurado${NC}"

# =============================================================================
# INICIAR WAHA
# =============================================================================

echo -e "${YELLOW}[8/8] Iniciando WAHA...${NC}"

cd /opt/waha

# Baixar imagem
docker pull devlikeapro/waha:latest

# Iniciar serviços
docker-compose up -d

# Aguardar inicialização
echo ""
echo -e "${YELLOW}Aguardando WAHA iniciar (30 segundos)...${NC}"
sleep 30

# Verificar status
if docker ps | grep -q waha; then
    echo -e "${GREEN}✅ WAHA está rodando!${NC}"
else
    echo -e "${RED}❌ Erro ao iniciar WAHA${NC}"
    echo "Verifique os logs: docker logs waha"
    exit 1
fi

# =============================================================================
# CONFIGURAR BACKUP AUTOMÁTICO
# =============================================================================

echo -e "${YELLOW}Configurando backup automático...${NC}"

# Script de backup
cat > /opt/waha/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/waha/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Criar backup
tar -czf "$BACKUP_DIR/waha_backup_$DATE.tar.gz" -C /opt/waha/data .sessions/

# Manter apenas últimos 7 backups
ls -t $BACKUP_DIR/waha_backup_*.tar.gz | tail -n +8 | xargs -r rm

echo "Backup criado: waha_backup_$DATE.tar.gz"
EOF

chmod +x /opt/waha/backup.sh

# Adicionar ao crontab (backup diário às 2h da manhã)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/waha/backup.sh >> /opt/waha/logs/backup.log 2>&1") | crontab -

echo -e "${GREEN}✅ Backup automático configurado${NC}"

# =============================================================================
# CONFIGURAR MONITORAMENTO
# =============================================================================

echo -e "${YELLOW}Configurando monitoramento...${NC}"

# Script de health check
cat > /opt/waha/health-check.sh << 'EOF'
#!/bin/bash
if ! docker ps | grep -q waha; then
    echo "$(date): WAHA parado, reiniciando..." >> /opt/waha/logs/health.log
    cd /opt/waha && docker-compose restart
fi
EOF

chmod +x /opt/waha/health-check.sh

# Adicionar ao crontab (verificar a cada 5 minutos)
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/waha/health-check.sh") | crontab -

echo -e "${GREEN}✅ Monitoramento configurado${NC}"

# =============================================================================
# INFORMAÇÕES FINAIS
# =============================================================================

echo ""
echo "=========================================="
echo -e "${GREEN}✅ INSTALAÇÃO CONCLUÍDA!${NC}"
echo "=========================================="
echo ""
echo -e "📍 ${YELLOW}Acesse o WAHA:${NC}"
echo "   http://$(curl -s ifconfig.me):3000"
echo ""
echo -e "📋 ${YELLOW}Comandos úteis:${NC}"
echo "   Ver logs:        docker logs waha -f"
echo "   Reiniciar:       cd /opt/waha && docker-compose restart"
echo "   Parar:           cd /opt/waha && docker-compose stop"
echo "   Atualizar:       cd /opt/waha && docker-compose pull && docker-compose up -d"
echo ""
echo -e "📁 ${YELLOW}Pastas importantes:${NC}"
echo "   Dados:           /opt/waha/data/.sessions"
echo "   Logs:            /opt/waha/logs"
echo "   Backups:         /opt/waha/backups"
echo "   Config:          /opt/waha/docker-compose.yml"
echo ""
echo -e "🔥 ${YELLOW}Firewall:${NC}"
echo "   Porta 3000:      ABERTA"
echo "   Porta 22 (SSH):  ABERTA"
echo "   Outras:          FECHADAS"
echo ""
echo -e "⚠️  ${YELLOW}PRÓXIMOS PASSOS:${NC}"
echo "   1. Acesse: http://$(curl -s ifconfig.me):3000"
echo "   2. Clique em 'Start Session'"
echo "   3. Escaneie o QR Code com seu celular"
echo "   4. Configure o Ortholab com a URL do WAHA"
echo ""
echo -e "📖 ${YELLOW}Documentação:${NC} https://waha.devlike.pro/"
echo ""

# Salvar informações
cat > /opt/waha/INFO.txt << EOF
WAHA - WhatsApp API
===================

URL de acesso: http://$(curl -s ifconfig.me):3000
Instalado em: $(date)

COMANDOS:
- Ver status:     docker ps
- Ver logs:       docker logs waha -f
- Reiniciar:      cd /opt/waha && docker-compose restart
- Backup manual:  /opt/waha/backup.sh

CONFIGURAÇÃO ORTHOLAB:
WAHA_API_URL=http://$(curl -s ifconfig.me):3000
WAHA_SESSION_NAME=ortholab
EOF

echo -e "${GREEN}Informações salvas em: /opt/waha/INFO.txt${NC}"
echo ""
