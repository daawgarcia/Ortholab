#!/bin/bash

# =============================================================================
# SCRIPT DE BACKUP DO ORTHOLAB - AWS PARA COMPUTADOR LOCAL
# =============================================================================
# Este script faz backup do banco de dados e arquivos do Ortholab
# NÃO ALTERA NADA NO SERVIDOR AWS - APENAS FAZ DOWNLOAD
# =============================================================================

set -e  # Para execução se houver erro

echo "=========================================="
echo "BACKUP DO ORTHOLAB - AWS PARA LOCAL"
echo "=========================================="
echo ""

# =============================================================================
# CONFIGURAÇÕES - ALTERE AQUI
# =============================================================================

# Caminho para sua chave SSH da AWS (arquivo .pem)
AWS_KEY_PATH="$HOME/Downloads/ortholab-key.pem"

# Usuário e IP da instância EC2 na AWS
AWS_USER="ubuntu"
AWS_IP="ec2-xxx-xxx-xxx-xxx.sa-east-1.compute.amazonaws.com"
# ^^^ SUBSTITUA PELO IP/ENDEREÇO REAL DA SUA INSTÂNCIA

# Pasta local onde os backups serão salvos
BACKUP_DIR="$HOME/ortholab_backup_$(date +%Y%m%d_%H%M%S)"

# =============================================================================
# VERIFICAÇÕES INICIAIS
# =============================================================================

echo "1. Verificando pré-requisitos..."
echo ""

# Verifica se a chave SSH existe
if [ ! -f "$AWS_KEY_PATH" ]; then
    echo "❌ ERRO: Chave SSH não encontrada em: $AWS_KEY_PATH"
    echo ""
    echo "Por favor, verifique:"
    echo "1. O caminho da chave .pem"
    echo "2. Se o arquivo existe"
    echo ""
    echo "Caminhos comuns:"
    echo "  - ~/Downloads/ortholab-key.pem"
    echo "  - ~/Documents/ortholab-key.pem"
    echo "  - ~/.ssh/ortholab-key.pem"
    exit 1
fi

echo "✅ Chave SSH encontrada"

# Verifica se a chave tem permissões corretas
KEY_PERMS=$(stat -c "%a" "$AWS_KEY_PATH" 2>/dev/null || stat -f "%A" "$AWS_KEY_PATH")
if [ "$KEY_PERMS" != "400" ] && [ "$KEY_PERMS" != "600" ]; then
    echo "⚠️  Ajustando permissões da chave SSH..."
    chmod 400 "$AWS_KEY_PATH"
fi

# Verifica comandos necessários
for cmd in ssh scp rsync; do
    if ! command -v $cmd &> /dev/null; then
        echo "❌ ERRO: Comando '$cmd' não encontrado"
        echo "Instale o OpenSSH:"
        echo "  Windows (Git Bash): https://git-scm.com/download/win"
        echo "  Mac: brew install openssh"
        echo "  Linux: sudo apt install openssh-client"
        exit 1
    fi
done

echo "✅ Todos os comandos necessários disponíveis"

# Cria pasta de backup
mkdir -p "$BACKUP_DIR"
echo "✅ Pasta de backup criada: $BACKUP_DIR"

echo ""
echo "=========================================="
echo "2. Conectando ao servidor AWS..."
echo "=========================================="
echo ""

# Testa conexão SSH
echo "Testando conexão SSH..."
if ! ssh -i "$AWS_KEY_PATH" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$AWS_USER@$AWS_IP" "echo 'Conexão OK'" 2>/dev/null; then
    echo "❌ ERRO: Não foi possível conectar ao servidor AWS"
    echo ""
    echo "Verifique:"
    echo "1. Se o IP/hostname está correto"
    echo "2. Se a instância EC2 está rodando"
    echo "3. Se o Security Group permite conexão SSH (porta 22)"
    echo "4. Se está na VPN (se necessário)"
    exit 1
fi

echo "✅ Conexão SSH estabelecida"

echo ""
echo "=========================================="
echo "3. Backup do Banco de Dados"
echo "=========================================="
echo ""

# Detecta variáveis de ambiente no servidor
echo "Detectando configurações do banco..."

# Tenta encontrar DATABASE_URL
DB_URL=$(ssh -i "$AWS_KEY_PATH" -o StrictHostKeyChecking=no "$AWS_USER@$AWS_IP" "
    # Procura em arquivos .env comuns
    for file in /var/www/ortholab/.env /home/ubuntu/ortholab/.env /opt/ortholab/.env /app/.env ~/.env; do
        if [ -f \"\$file\" ]; then
            grep DATABASE_URL \"\$file\" | head -1 | cut -d= -f2-
            break
        fi
    done
" 2>/dev/null || echo "")

if [ -z "$DB_URL" ]; then
    echo "⚠️  Não foi possível detectar DATABASE_URL automaticamente"
    echo ""
    echo "Opções:"
    echo "1. Verificar manualmente no servidor:"
    echo "   ssh -i $AWS_KEY_PATH $AWS_USER@$AWS_IP"
    echo "   cat /var/www/ortholab/.env | grep DATABASE"
    echo ""
    echo "2. Ou informe a DATABASE_URL manualmente no script"
    echo ""
    read -p "Deseja informar a DATABASE_URL manualmente? (s/n): " resposta
    if [ "$resposta" = "s" ]; then
        read -p "DATABASE_URL: " DB_URL
    else
        echo "Pulando backup do banco..."
        DB_URL=""
    fi
fi

if [ -n "$DB_URL" ]; then
    echo "✅ DATABASE_URL encontrada"
    echo "Iniciando backup do PostgreSQL..."
    echo "(Isso pode levar alguns minutos dependendo do tamanho do banco)"
    echo ""
    
    # Faz o dump do banco
    ssh -i "$AWS_KEY_PATH" -o StrictHostKeyChecking=no "$AWS_USER@$AWS_IP" "
        export PGPASSWORD=\$(echo '$DB_URL' | sed 's/.*://; s/@.*//')
        pg_dump '$DB_URL' 2>/dev/null || echo 'ERRO_NO_DUMP'
    " > "$BACKUP_DIR/ortholab_database.sql"
    
    # Verifica se o dump foi bem sucedido
    if grep -q "ERRO_NO_DUMP" "$BACKUP_DIR/ortholab_database.sql" 2>/dev/null || [ ! -s "$BACKUP_DIR/ortholab_database.sql" ]; then
        echo "❌ ERRO ao fazer backup do banco"
        rm -f "$BACKUP_DIR/ortholab_database.sql"
    else
        # Remove linha de erro se existir
        sed -i '/ERRO_NO_DUMP/d' "$BACKUP_DIR/ortholab_database.sql" 2>/dev/null || true
        
        DB_SIZE=$(du -h "$BACKUP_DIR/ortholab_database.sql" | cut -f1)
        echo "✅ Backup do banco concluído: $DB_SIZE"
    fi
fi

echo ""
echo "=========================================="
echo "4. Backup dos Arquivos de Upload"
echo "=========================================="
echo ""

# Procura por pastas de upload comuns
UPLOAD_FOLDERS=(
    "/var/www/ortholab/uploads"
    "/var/www/ortholab/packages/backend/uploads"
    "/home/ubuntu/ortholab/uploads"
    "/opt/ortholab/uploads"
    "/app/uploads"
)

FOUND_UPLOADS=""

for folder in "${UPLOAD_FOLDERS[@]}"; do
    echo "Procurando: $folder..."
    if ssh -i "$AWS_KEY_PATH" -o StrictHostKeyChecking=no "$AWS_USER@$AWS_IP" "[ -d '$folder' ]" 2>/dev/null; then
        echo "✅ Pasta encontrada: $folder"
        FOUND_UPLOADS="$folder"
        break
    fi
done

if [ -z "$FOUND_UPLOADS" ]; then
    echo "⚠️  Pasta de uploads não encontrada nos caminhos padrão"
    echo ""
    echo "Buscando em todo o servidor..."
    
    FOUND_UPLOADS=$(ssh -i "$AWS_KEY_PATH" -o StrictHostKeyChecking=no "$AWS_USER@$AWS_IP" "
        find /var/www /home /opt /app -type d -name 'uploads' 2>/dev/null | head -1
    " 2>/dev/null || echo "")
    
    if [ -n "$FOUND_UPLOADS" ]; then
        echo "✅ Pasta encontrada: $FOUND_UPLOADS"
    fi
fi

if [ -n "$FOUND_UPLOADS" ]; then
    echo ""
    echo "Iniciando download dos arquivos..."
    echo "(Isso pode levar bastante tempo dependendo da quantidade de arquivos)"
    echo ""
    
    # Cria pasta local para uploads
    mkdir -p "$BACKUP_DIR/uploads"
    
    # Faz o download usando rsync (mais eficiente)
    rsync -avz --progress \
        -e "ssh -i '$AWS_KEY_PATH' -o StrictHostKeyChecking=no" \
        "$AWS_USER@$AWS_IP:$FOUND_UPLOADS/" \
        "$BACKUP_DIR/uploads/" 2>&1 | tee "$BACKUP_DIR/rsync.log"
    
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        UPLOAD_SIZE=$(du -sh "$BACKUP_DIR/uploads" | cut -f1)
        echo ""
        echo "✅ Download de arquivos concluído: $UPLOAD_SIZE"
    else
        echo "⚠️  Alguns arquivos podem não ter sido copiados. Verifique o log: $BACKUP_DIR/rsync.log"
    fi
else
    echo "❌ Não foi possível encontrar a pasta de uploads"
fi

echo ""
echo "=========================================="
echo "5. Backup das Variáveis de Ambiente"
echo "=========================================="
echo ""

# Tenta baixar arquivos .env
ENV_FILES=(
    "/var/www/ortholab/.env"
    "/var/www/ortholab/packages/backend/.env"
    "/home/ubuntu/ortholab/.env"
    "/opt/ortholab/.env"
    "/app/.env"
)

for env_file in "${ENV_FILES[@]}"; do
    echo "Procurando: $env_file..."
    if ssh -i "$AWS_KEY_PATH" -o StrictHostKeyChecking=no "$AWS_USER@$AWS_IP" "[ -f '$env_file' ]" 2>/dev/null; then
        echo "✅ Arquivo encontrado, baixando..."
        scp -i "$AWS_KEY_PATH" -o StrictHostKeyChecking=no \
            "$AWS_USER@$AWS_IP:$env_file" \
            "$BACKUP_DIR/env_$(basename $(dirname $env_file)).txt" 2>/dev/null || true
    fi
done

echo ""
echo "=========================================="
echo "6. Informações do Sistema"
echo "=========================================="
echo ""

# Coleta informações úteis
ssh -i "$AWS_KEY_PATH" -o StrictHostKeyChecking=no "$AWS_USER@$AWS_IP" "
    echo '=== INFORMAÇÕES DO SERVIDOR ==='
    echo 'Data: \$(date)'
    echo ''
    echo '=== VERSÕES ==='
    node --version 2>/dev/null || echo 'Node não encontrado'
    npm --version 2>/dev/null || echo 'NPM não encontrado'
    psql --version 2>/dev/null || echo 'PostgreSQL não encontrado'
    echo ''
    echo '=== PROCESSOS ==='
    pm2 list 2>/dev/null || echo 'PM2 não encontrado'
    echo ''
    echo '=== DISCO ==='
    df -h
    echo ''
    echo '=== MEMÓRIA ==='
    free -h 2>/dev/null || echo 'Comando free não disponível'
" > "$BACKUP_DIR/server_info.txt" 2>/dev/null || echo "⚠️  Não foi possível coletar informações do servidor"

echo "✅ Informações do servidor salvas"

echo ""
echo "=========================================="
echo "BACKUP CONCLUÍDO!"
echo "=========================================="
echo ""
echo "📁 Local do backup: $BACKUP_DIR"
echo ""
echo "Conteúdo do backup:"
ls -lah "$BACKUP_DIR/"
echo ""
echo "=========================================="
echo "PRÓXIMOS PASSOS"
echo "=========================================="
echo ""
echo "1. Verifique se todos os arquivos foram baixados corretamente"
echo "2. Guarde a pasta de backup em local seguro"
echo "3. Para restaurar no novo servidor, use o script de restore"
echo ""
echo "Arquivos importantes:"
echo "  - ortholab_database.sql (banco de dados)"
echo "  - uploads/ (arquivos)"
echo "  - env_*.txt (configurações)"
echo ""

# Cria um resumo
{
    echo "BACKUP ORTHOLAB"
    echo "Data: $(date)"
    echo "Servidor: $AWS_IP"
    echo ""
    echo "ARQUIVOS:"
    ls -la "$BACKUP_DIR/"
} > "$BACKUP_DIR/README.txt"

echo "✅ Resumo salvo em: $BACKUP_DIR/README.txt"
echo ""
read -p "Pressione ENTER para sair..."
