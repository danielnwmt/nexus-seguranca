#!/bin/bash
# ============================================================
#  Bravo Monitoramento — Instalador Online (One-Liner)
#  
#  USO:
#    curl -fsSL https://raw.githubusercontent.com/SEU_USUARIO/bravo-monitoramento/main/installer/install-online.sh | sudo bash
#
#  OU com repositorio customizado:
#    curl -fsSL URL_DO_SCRIPT | sudo REPO_URL="https://github.com/user/repo" bash
#
# ============================================================

set -e

REPO_URL="${REPO_URL:-https://github.com/SEU_USUARIO/bravo-monitoramento}"
BRANCH="${BRANCH:-main}"
INSTALL_DIR="${INSTALL_DIR:-/opt/bravo-monitoramento}"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "   BRAVO MONITORAMENTO — Instalador Online"
echo -e "   Instalacao automatica via GitHub"
echo -e "${CYAN}=============================================${NC}"
echo ""

# Verificar root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[X] Execute como root: curl ... | sudo bash${NC}"
  exit 1
fi

# Instalar git se necessario
if ! command -v git &> /dev/null; then
  echo -e "${YELLOW}>> Instalando git...${NC}"
  apt-get update -qq && apt-get install -y -qq git > /dev/null 2>&1
fi

# Clonar repositorio
if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "${GREEN}>> Repositorio ja existe. Atualizando...${NC}"
  cd "$INSTALL_DIR"
  git fetch origin "$BRANCH" 
  git reset --hard "origin/$BRANCH"
else
  echo -e "${CYAN}>> Clonando repositorio...${NC}"
  git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Executar instalador principal
echo ""
echo -e "${CYAN}>> Executando instalador principal...${NC}"
echo ""
bash install-ubuntu.sh

echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "   Instalacao online concluida!"
echo -e "   Para atualizar no futuro, use o botao"
echo -e "   'Atualizar Sistema' nas Configuracoes"
echo -e "   ou execute: bash $INSTALL_DIR/atualizar-bravo.sh"
echo -e "${GREEN}=============================================${NC}"
echo ""
