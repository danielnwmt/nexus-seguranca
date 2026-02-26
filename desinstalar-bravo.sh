#!/bin/bash
# ============================================================
#  Bravo Monitoramento — Desinstalador Ubuntu
#  Execute como root: sudo bash desinstalar-bravo.sh
# ============================================================

set -e

INSTALL_DIR="${INSTALL_DIR:-/opt/bravo-monitoramento}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Execute como root: sudo bash desinstalar-bravo.sh${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}=============================================${NC}"
echo -e "   BRAVO MONITORAMENTO — Desinstalador"
echo -e "${YELLOW}=============================================${NC}"
echo ""

read -p "Deseja remover o Bravo Monitoramento? (s/N): " CONFIRMA
if [ "$CONFIRMA" != "s" ] && [ "$CONFIRMA" != "S" ]; then
  echo "Cancelado."
  exit 0
fi

echo ""
echo "Parando servicos..."
systemctl stop bravo-mediamtx 2>/dev/null || true
systemctl stop bravo-auth 2>/dev/null || true
systemctl stop bravo-postgrest 2>/dev/null || true
systemctl disable bravo-mediamtx 2>/dev/null || true
systemctl disable bravo-auth 2>/dev/null || true
systemctl disable bravo-postgrest 2>/dev/null || true

echo "Removendo servicos..."
rm -f /etc/systemd/system/bravo-postgrest.service
rm -f /etc/systemd/system/bravo-auth.service
rm -f /etc/systemd/system/bravo-mediamtx.service
systemctl daemon-reload

echo "Removendo configuracao Nginx..."
rm -f /etc/nginx/sites-enabled/bravo
rm -f /etc/nginx/sites-available/bravo
systemctl restart nginx 2>/dev/null || true

read -p "Remover banco de dados 'bravo'? (s/N): " RM_DB
if [ "$RM_DB" = "s" ] || [ "$RM_DB" = "S" ]; then
  sudo -u postgres psql -c "DROP DATABASE IF EXISTS bravo;" 2>/dev/null || true
  echo -e "${GREEN}Banco de dados removido.${NC}"
fi

read -p "Remover arquivos de $INSTALL_DIR? (s/N): " RM_FILES
if [ "$RM_FILES" = "s" ] || [ "$RM_FILES" = "S" ]; then
  rm -rf "$INSTALL_DIR"
  echo -e "${GREEN}Arquivos removidos.${NC}"
fi

echo ""
echo -e "${GREEN}Desinstalacao concluida.${NC}"
echo -e "${YELLOW}Nota: PostgreSQL e Node.js nao foram removidos.${NC}"
echo ""
