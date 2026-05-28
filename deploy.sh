#!/bin/bash

# =============================================================================
# SCRIPT DE DEPLOY DO ORTHOLAB
# =============================================================================

echo "=========================================="
echo "DEPLOY DO ORTHOLAB"
echo "=========================================="
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cd packages/backend

echo -e "${YELLOW}[1/4] Instalando dependências...${NC}"
npm install

echo -e "${YELLOW}[2/4] Gerando cliente Prisma...${NC}"
npx prisma generate

echo -e "${YELLOW}[3/4] Rodando migrations...${NC}"
npx prisma migrate deploy

echo -e "${YELLOW}[4/4] Buildando projeto...${NC}"
npm run build

echo -e "${GREEN}✅ Backend pronto para deploy!${NC}"
echo ""

# Verificar variáveis de ambiente
echo -e "${YELLOW}Verificando variáveis de ambiente...${NC}"

required_vars=(
  "DATABASE_URL"
  "JWT_SECRET"
  "FRONTEND_URL"
  "WAHA_API_URL"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo -e "${RED}❌ $var não está definida${NC}"
  else
    echo -e "${GREEN}✅ $var definida${NC}"
  fi
done

echo ""
echo "=========================================="
echo "Próximos passos:"
echo "=========================================="
echo "1. Commit e push das alterações"
echo "2. Deploy no Render/Railway"
echo "3. Deploy do frontend no Vercel"
echo "4. Verificar WAHA na Hostinger"
echo ""
