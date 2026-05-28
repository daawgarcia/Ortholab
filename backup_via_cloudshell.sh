#!/bin/bash

# Script de backup do Ortholab via CloudShell
# Este script roda no AWS CloudShell e conecta na instância EC2

echo "=========================================="
echo "BACKUP ORTHOLAB VIA CLOUDSHELL"
echo "=========================================="
echo ""

# Configurações
EC2_IP="18.235.13.94"
EC2_USER="ubuntu"
BACKUP_DIR="ortholab_backup_$(date +%Y%m%d_%H%M%S)"

echo "1. Criando pasta de backup..."
mkdir -p ~/$BACKUP_DIR
cd ~/$BACKUP_DIR

echo ""
echo "2. Tentando conectar na instância EC2..."
echo "   IP: $EC2_IP"
echo "   Usuário: $EC2_USER"
echo ""

# Verificar se conseguimos ping
ping -c 1 $EC2_IP > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Instância está respondendo ao ping"
else
    echo "⚠️  Instância não responde ao ping (pode ser normal)"
fi

echo ""
echo "3. Verificando se há chave SSH no CloudShell..."
ls -la ~/.ssh/ 2>/dev/null || echo "Nenhuma chave encontrada em ~/.ssh/"

echo ""
echo "=========================================="
echo "INSTRUÇÕES:"
echo "=========================================="
echo ""
echo "Como não temos a chave .pem, vamos usar outra abordagem:"
echo ""
echo "OPÇÃO 1: Criar snapshot do volume EBS (mais seguro)"
echo "OPÇÃO 2: Usar AWS Systems Manager (SSM) se estiver configurado"
echo "OPÇÃO 3: Pedir para quem tem a chave .pem fazer o backup"
echo ""
echo "Vamos tentar a OPÇÃO 2 - AWS Systems Manager:"
echo ""

# Verificar se SSM está instalado
which aws
if [ $? -eq 0 ]; then
    echo "✅ AWS CLI encontrado"
    
    echo ""
    echo "Tentando conectar via SSM..."
    echo "Comando: aws ssm start-session --target i-0908e5af56ded2850"
    echo ""
    echo "Se o comando abaixo falhar, o SSM não está configurado."
    echo ""
    
    # Tentar conexão SSM
    aws ssm start-session --target i-0908e5af56ded2850 --region us-east-1 2>&1 | head -20
else
    echo "❌ AWS CLI não encontrado no CloudShell (isso é estranho)"
fi

echo ""
echo "=========================================="
echo "ALTERNATIVA: Criar Snapshot do Volume"
echo "=========================================="
echo ""
echo "Isso criará uma cópia completa do disco da instância:"
echo ""

# Listar volumes da instância
echo "Buscando volumes da instância..."
aws ec2 describe-instances --instance-ids i-0908e5af56ded2850 --query 'Reservations[0].Instances[0].BlockDeviceMappings' --region us-east-1 2>/dev/null || echo "Não foi possível listar volumes"

echo ""
echo "Para criar snapshot, execute:"
echo "aws ec2 create-snapshot --volume-id VOLUME_ID --description 'Backup Ortholab'"
echo ""

echo "=========================================="
echo "RESUMO"
echo "=========================================="
echo ""
echo "Para fazer backup do Ortholab, você precisa:"
echo ""
echo "1. TER A CHAVE .PEM original, OU"
echo "2. Configurar AWS Systems Manager (SSM) na instância, OU"  
echo "3. Criar snapshot do volume EBS (recomendado)"
echo ""
echo "Qual opção prefere?"
