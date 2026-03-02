#!/bin/bash
# ============================================================
#  Nexus Monitoramento — Instalador Completo Ubuntu 24.04 LTS
#  Instala: PostgreSQL + PostgREST + Auth Server + MediaMTX + Frontend
#  SEM Docker! Tudo nativo.
#  Execute como root:
#    sudo bash install-ubuntu.sh
# ============================================================

set -e

# ---------- Parametros (editaveis) ----------
INSTALL_DIR="${INSTALL_DIR:-/opt/nexus-monitoramento}"
REPO_URL="${REPO_URL:-https://github.com/danielnwmt/nexus-seguranca}"
PORT="${PORT:-80}"
API_PORT="${API_PORT:-8001}"
POSTGREST_PORT="${POSTGREST_PORT:-3000}"
PG_PASSWORD="${PG_PASSWORD:-NexusDb2024}"
JWT_SECRET="${JWT_SECRET:-nexus-monitoramento-jwt-secret-key-2024-super-seguro}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@protenexus.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-1234}"

# ---------- Cores ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

step()  { echo -e "\n${CYAN}>> $1${NC}"; }
ok()    { echo -e "  ${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "  ${YELLOW}[!]${NC} $1"; }
err()   { echo -e "  ${RED}[X]${NC} $1"; exit 1; }

# ---------- Verificar root ----------
if [ "$EUID" -ne 0 ]; then
  err "Execute como root: sudo bash install-ubuntu.sh"
fi

echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "   NEXUS MONITORAMENTO — Instalador Ubuntu"
echo -e "   PostgreSQL + PostgREST + MediaMTX + Frontend"
echo -e "   (Sem Docker!)"
echo -e "${CYAN}=============================================${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ----------------------------------------------------------
# 1. Atualizar sistema e instalar dependencias basicas
# ----------------------------------------------------------
step "Atualizando sistema e instalando dependencias..."
apt-get update -qq
apt-get install -y -qq curl wget gnupg2 lsb-release ca-certificates git build-essential ufw > /dev/null 2>&1
ok "Dependencias basicas instaladas"

# ----------------------------------------------------------
# 2. Instalar Node.js 20 LTS
# ----------------------------------------------------------
step "Verificando Node.js..."
if command -v node &> /dev/null; then
  NODE_VER=$(node -v)
  ok "Node.js encontrado: $NODE_VER"
else
  warn "Node.js nao encontrado. Instalando Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null 2>&1
  ok "Node.js instalado: $(node -v)"
fi

# ----------------------------------------------------------
# 3. Instalar PostgreSQL 16
# ----------------------------------------------------------
step "Verificando PostgreSQL..."
if command -v psql &> /dev/null; then
  PG_VER=$(psql --version | head -1)
  ok "PostgreSQL encontrado: $PG_VER"
else
  warn "PostgreSQL nao encontrado. Instalando PostgreSQL 16..."
  echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
  apt-get update -qq
  apt-get install -y -qq postgresql-16 postgresql-contrib-16 > /dev/null 2>&1
  ok "PostgreSQL 16 instalado"
fi

# Garantir que PostgreSQL esta rodando
systemctl enable postgresql > /dev/null 2>&1
systemctl start postgresql
ok "PostgreSQL rodando"

# ----------------------------------------------------------
# 4. Configurar banco de dados
# ----------------------------------------------------------
step "Configurando banco de dados..."

# Definir senha do postgres
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '$PG_PASSWORD';" > /dev/null 2>&1

# Criar banco
DB_EXISTS=$(sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='nexus'" 2>/dev/null | tr -d ' ')
if [ "$DB_EXISTS" = "1" ]; then
  ok "Banco 'nexus' ja existe"
else
  sudo -u postgres psql -c "CREATE DATABASE nexus;" > /dev/null 2>&1
  ok "Banco 'nexus' criado"
fi

# Executar script de inicializacao
SQL_FILE="$SCRIPT_DIR/installer/init-database.sql"
if [ ! -f "$SQL_FILE" ]; then
  SQL_FILE="$INSTALL_DIR/installer/init-database.sql"
fi

if [ -f "$SQL_FILE" ]; then
  sudo -u postgres psql -d nexus -f "$SQL_FILE" > /dev/null 2>&1
  ok "Tabelas e funcoes criadas"
else
  err "Arquivo init-database.sql nao encontrado em: $SQL_FILE"
fi

# Criar usuario admin
sudo -u postgres psql -d nexus -c "
  INSERT INTO auth.users (email, encrypted_password)
  VALUES ('$ADMIN_EMAIL', crypt('$ADMIN_PASSWORD', gen_salt('bf')))
  ON CONFLICT (email) DO NOTHING;
" > /dev/null 2>&1
ok "Usuario admin criado: $ADMIN_EMAIL"

# ----------------------------------------------------------
# 5. Configurar armazenamento local
# ----------------------------------------------------------
step "Configurando armazenamento local..."

STORAGE_PATH="$INSTALL_DIR/gravacoes"
mkdir -p "$STORAGE_PATH/_modelo/CAM01"
ok "Pasta de gravacoes criada: $STORAGE_PATH"

LOCAL_IP=$(hostname -I | awk '{print $1}')
[ -z "$LOCAL_IP" ] && LOCAL_IP="127.0.0.1"

DISK_GB=$(df -BG "$INSTALL_DIR" 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'G')
[ -z "$DISK_GB" ] && DISK_GB=100

sudo -u postgres psql -d nexus -c "
  INSERT INTO public.storage_servers (name, ip_address, storage_path, max_storage_gb, status, description)
  VALUES ('Servidor Local', '$LOCAL_IP', '$STORAGE_PATH', $DISK_GB, 'active', 'Servidor de gravacao local - configurado automaticamente')
  ON CONFLICT DO NOTHING;
" > /dev/null 2>&1 || warn "Nao foi possivel registrar servidor automaticamente"
ok "Servidor de gravacao registrado (IP: $LOCAL_IP)"

# ----------------------------------------------------------
# 6. Instalar PostgREST
# ----------------------------------------------------------
step "Instalando PostgREST..."

POSTGREST_DIR="$INSTALL_DIR/postgrest"
POSTGREST_BIN="$POSTGREST_DIR/postgrest"

if [ -f "$POSTGREST_BIN" ]; then
  ok "PostgREST ja instalado"
else
  mkdir -p "$POSTGREST_DIR"
  ARCH=$(uname -m)
  if [ "$ARCH" = "x86_64" ]; then
    POSTGREST_URL="https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz"
  elif [ "$ARCH" = "aarch64" ]; then
    POSTGREST_URL="https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-arm64.tar.xz"
  else
    err "Arquitetura $ARCH nao suportada para PostgREST"
  fi

  wget -q "$POSTGREST_URL" -O /tmp/postgrest.tar.xz
  tar xf /tmp/postgrest.tar.xz -C "$POSTGREST_DIR"
  rm -f /tmp/postgrest.tar.xz
  chmod +x "$POSTGREST_BIN"
  ok "PostgREST instalado"
fi

# Criar config
cat > "$POSTGREST_DIR/postgrest.conf" << EOF
db-uri = "postgres://authenticator:nexus_auth_2024@localhost:5432/nexus"
db-schemas = "public"
db-anon-role = "anon"
db-pool = 10
server-host = "127.0.0.1"
server-port = $POSTGREST_PORT
jwt-secret = "$JWT_SECRET"
EOF
ok "Configuracao PostgREST criada"

sudo -u postgres psql -d nexus -c "ALTER ROLE authenticator WITH PASSWORD 'nexus_auth_2024';" > /dev/null 2>&1

# ----------------------------------------------------------
# 7. Configurar Auth Server
# ----------------------------------------------------------
step "Configurando Auth Server..."

AUTH_DIR="$INSTALL_DIR/auth-server"
mkdir -p "$AUTH_DIR"

AUTH_SRC="$SCRIPT_DIR/installer/auth-server.js"
[ ! -f "$AUTH_SRC" ] && AUTH_SRC="$INSTALL_DIR/installer/auth-server.js"

if [ -f "$AUTH_SRC" ]; then
  cp "$AUTH_SRC" "$AUTH_DIR/server.js"
  # Ajustar configuracoes
  sed -i "s|const PORT = [0-9]*;|const PORT = $API_PORT;|" "$AUTH_DIR/server.js"
  sed -i "s|const JWT_SECRET = '[^']*';|const JWT_SECRET = '$JWT_SECRET';|" "$AUTH_DIR/server.js"
  sed -i "s|const POSTGREST_URL = '[^']*';|const POSTGREST_URL = 'http://127.0.0.1:$POSTGREST_PORT';|" "$AUTH_DIR/server.js"
  sed -i "s|password: ''|password: '$PG_PASSWORD'|" "$AUTH_DIR/server.js"
else
  err "auth-server.js nao encontrado"
fi

cd "$AUTH_DIR"
npm init -y > /dev/null 2>&1
npm install pg > /dev/null 2>&1
ok "Auth Server configurado"

# ----------------------------------------------------------
# 8. Instalar MediaMTX (Servidor de Midia)
# ----------------------------------------------------------
step "Instalando MediaMTX (servidor de midia)..."

MEDIAMTX_DIR="$INSTALL_DIR/mediamtx"
MEDIAMTX_BIN="$MEDIAMTX_DIR/mediamtx"

if [ -f "$MEDIAMTX_BIN" ]; then
  ok "MediaMTX ja instalado"
else
  mkdir -p "$MEDIAMTX_DIR"
  ARCH=$(uname -m)
  if [ "$ARCH" = "x86_64" ]; then
    MEDIAMTX_URL="https://github.com/bluenviron/mediamtx/releases/download/v1.9.3/mediamtx_v1.9.3_linux_amd64.tar.gz"
  elif [ "$ARCH" = "aarch64" ]; then
    MEDIAMTX_URL="https://github.com/bluenviron/mediamtx/releases/download/v1.9.3/mediamtx_v1.9.3_linux_arm64v8.tar.gz"
  else
    err "Arquitetura $ARCH nao suportada para MediaMTX"
  fi

  wget -q "$MEDIAMTX_URL" -O /tmp/mediamtx.tar.gz
  tar xf /tmp/mediamtx.tar.gz -C "$MEDIAMTX_DIR"
  rm -f /tmp/mediamtx.tar.gz
  chmod +x "$MEDIAMTX_BIN"
  ok "MediaMTX instalado"
fi

# Copiar config personalizada
MEDIAMTX_CFG_SRC="$SCRIPT_DIR/installer/mediamtx.yml"
[ ! -f "$MEDIAMTX_CFG_SRC" ] && MEDIAMTX_CFG_SRC="$INSTALL_DIR/installer/mediamtx.yml"
if [ -f "$MEDIAMTX_CFG_SRC" ]; then
  cp "$MEDIAMTX_CFG_SRC" "$MEDIAMTX_DIR/mediamtx.yml"
  ok "Configuracao MediaMTX copiada"
fi

# Registrar servidor de midia no banco automaticamente
sudo -u postgres psql -d nexus -c "
  INSERT INTO public.media_servers (name, ip_address, instances, rtmp_base_port, hls_base_port, webrtc_base_port, status)
  VALUES ('Servidor Local', '$LOCAL_IP', 1, 1935, 8888, 8889, 'active')
  ON CONFLICT DO NOTHING;
" > /dev/null 2>&1 || warn "Nao foi possivel registrar servidor de midia automaticamente"
ok "Servidor de midia registrado (IP: $LOCAL_IP)"

# ----------------------------------------------------------
# 8.2 Instalar ffmpeg (para captura de frames IA)
# ----------------------------------------------------------
step "Instalando ffmpeg (analise de video IA)..."
apt-get install -y -qq ffmpeg > /dev/null 2>&1
ok "ffmpeg instalado"

# ----------------------------------------------------------
# 8.3 Configurar servico de Analytics IA
# ----------------------------------------------------------
step "Configurando servico de Analytics IA..."

ANALYTICS_DIR="$INSTALL_DIR/analytics"
mkdir -p "$ANALYTICS_DIR/snapshots"

ANALYTICS_SRC="$SCRIPT_DIR/installer/analytics-service.js"
[ ! -f "$ANALYTICS_SRC" ] && ANALYTICS_SRC="$INSTALL_DIR/installer/analytics-service.js"
if [ -f "$ANALYTICS_SRC" ]; then
  cp "$ANALYTICS_SRC" "$ANALYTICS_DIR/analytics-service.js"
  ok "Servico de Analytics copiado"
fi

# ----------------------------------------------------------
# 9. Preparar frontend
# ----------------------------------------------------------
step "Preparando frontend..."

mkdir -p "$INSTALL_DIR"

if [ "$SCRIPT_DIR" != "$INSTALL_DIR" ]; then
  rsync -a --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='postgrest' --exclude='auth-server' --exclude='mediamtx' --exclude='gravacoes' "$SCRIPT_DIR/" "$INSTALL_DIR/"
  ok "Arquivos copiados para $INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ----------------------------------------------------------
# 10. Criar .env do frontend
# ----------------------------------------------------------
step "Configurando variaveis de ambiente..."

cat > "$INSTALL_DIR/.env" << EOF
VITE_SUPABASE_URL="http://$LOCAL_IP:$API_PORT"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMH0.local"
VITE_SUPABASE_PROJECT_ID="local"
VITE_API_URL="http://$LOCAL_IP:$API_PORT"
EOF
ok "Arquivo .env criado"

# ----------------------------------------------------------
# 11. Build do frontend
# ----------------------------------------------------------
step "Instalando dependencias..."
npm install --legacy-peer-deps > /dev/null 2>&1
ok "Dependencias instaladas"

step "Gerando build de producao..."
npm run build > /dev/null 2>&1

if [ -f "dist/index.html" ]; then
  ok "Build concluido"
else
  err "Build falhou. Execute 'npm run build' manualmente."
fi

# ----------------------------------------------------------
# 12. Instalar Nginx
# ----------------------------------------------------------
step "Instalando e configurando Nginx..."

apt-get install -y -qq nginx > /dev/null 2>&1

cat > /etc/nginx/sites-available/nexus << EOF
server {
    listen $PORT;
    server_name _;

    root $INSTALL_DIR/dist;
    index index.html;

    # SPA — todas as rotas caem no index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy para Auth Server
    location /auth/ {
        proxy_pass http://127.0.0.1:$API_PORT/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 900s;
        proxy_connect_timeout 30s;
        proxy_send_timeout 900s;
    }

    # Proxy para PostgREST (API REST)
    location /rest/ {
        proxy_pass http://127.0.0.1:$POSTGREST_PORT/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Proxy para HLS (MediaMTX)
    location /hls/ {
        proxy_pass http://127.0.0.1:8888/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # Cache para arquivos estaticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Logs
    access_log /var/log/nginx/nexus_access.log;
    error_log /var/log/nginx/nexus_error.log;
}
EOF

# Ativar site e desativar default
ln -sf /etc/nginx/sites-available/nexus /etc/nginx/sites-enabled/nexus
rm -f /etc/nginx/sites-enabled/default

nginx -t > /dev/null 2>&1
systemctl enable nginx > /dev/null 2>&1
systemctl restart nginx
ok "Nginx configurado na porta $PORT"

# ----------------------------------------------------------
# 13. Configurar firewall (UFW)
# ----------------------------------------------------------
step "Configurando firewall..."

ufw allow $PORT/tcp > /dev/null 2>&1
ufw allow $API_PORT/tcp comment "Auth API" > /dev/null 2>&1
ufw allow $POSTGREST_PORT/tcp comment "PostgREST API" > /dev/null 2>&1
ufw allow 1935/tcp comment "RTMP MediaMTX" > /dev/null 2>&1
ufw allow 8554/tcp comment "RTSP MediaMTX" > /dev/null 2>&1
ufw allow 8888/tcp comment "HLS MediaMTX" > /dev/null 2>&1
ufw allow 8889/tcp comment "WebRTC MediaMTX" > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1
ufw reload > /dev/null 2>&1
ok "Portas liberadas: $PORT, $API_PORT, $POSTGREST_PORT, 1935, 8554, 8888, 8889"
ok "Firewall ativado e recarregado"

# ----------------------------------------------------------
# 14. Criar servicos systemd
# ----------------------------------------------------------
step "Criando servicos systemd..."

# PostgREST
cat > /etc/systemd/system/nexus-postgrest.service << EOF
[Unit]
Description=Nexus - PostgREST (API REST)
After=postgresql.service
Requires=postgresql.service

[Service]
Type=simple
ExecStart=$POSTGREST_BIN $POSTGREST_DIR/postgrest.conf
Restart=always
RestartSec=5
User=nobody

[Install]
WantedBy=multi-user.target
EOF

# Auth Server (roda como root para acesso a sistema: ffmpeg, git, systemctl)
cat > /etc/systemd/system/nexus-auth.service << EOF
[Unit]
Description=Nexus - Auth Server
After=postgresql.service nexus-postgrest.service

[Service]
Type=simple
WorkingDirectory=$AUTH_DIR
ExecStart=$(which node) $AUTH_DIR/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=INSTALL_DIR=$INSTALL_DIR
User=root

[Install]
WantedBy=multi-user.target
EOF

# MediaMTX
cat > /etc/systemd/system/nexus-mediamtx.service << EOF
[Unit]
Description=Nexus - MediaMTX (Servidor de Midia RTMP/RTSP/HLS)
After=network.target

[Service]
Type=simple
WorkingDirectory=$MEDIAMTX_DIR
ExecStart=$MEDIAMTX_BIN $MEDIAMTX_DIR/mediamtx.yml
Restart=always
RestartSec=5
User=nobody
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

# Analytics IA
cat > /etc/systemd/system/nexus-analytics.service << EOF
[Unit]
Description=Nexus - Analytics IA (Analise de Video em Tempo Real)
After=postgresql.service nexus-mediamtx.service

[Service]
Type=simple
WorkingDirectory=$ANALYTICS_DIR
ExecStart=$(which node) $ANALYTICS_DIR/analytics-service.js
Restart=always
RestartSec=10
User=nobody
Environment=NODE_ENV=production
Environment=SUPABASE_URL=http://localhost:$API_PORT
Environment=SUPABASE_KEY=local
Environment=PG_HOST=localhost
Environment=PG_PORT=5432
Environment=PG_DB=nexus
Environment=PG_USER=postgres
Environment=PG_PASS=$PG_PASSWORD
Environment=MEDIAMTX_API=http://127.0.0.1:9997
Environment=MEDIAMTX_HLS=http://127.0.0.1:8888
Environment=TEMP_DIR=$ANALYTICS_DIR/snapshots

[Install]
WantedBy=multi-user.target
EOF

# Recarregar e ativar
systemctl daemon-reload
systemctl enable nexus-postgrest nexus-auth nexus-mediamtx nexus-analytics > /dev/null 2>&1
systemctl start nexus-postgrest
systemctl start nexus-auth
systemctl start nexus-mediamtx
systemctl start nexus-analytics
ok "4 servicos criados e iniciados (inicio automatico)"

# ----------------------------------------------------------
# 15. Scripts de controle
# ----------------------------------------------------------
step "Criando scripts de controle..."

cat > "$INSTALL_DIR/iniciar-nexus.sh" << 'SCRIPT'
#!/bin/bash
echo "Iniciando Nexus Monitoramento..."
sudo systemctl start postgresql
sudo systemctl start nexus-postgrest
sudo systemctl start nexus-auth
sudo systemctl start nexus-mediamtx
sudo systemctl start nexus-analytics
sudo systemctl start nginx
echo "Todos os servicos iniciados!"
echo ""
echo "Frontend:    http://localhost:PORT_PLACEHOLDER"
echo "RTMP:        rtmp://localhost:1935/{camera}"
echo "HLS:         http://localhost:8888/{camera}/"
echo "Analytics IA: ATIVO (analise em tempo real)"
SCRIPT
sed -i "s|PORT_PLACEHOLDER|$PORT|" "$INSTALL_DIR/iniciar-nexus.sh"

cat > "$INSTALL_DIR/parar-nexus.sh" << 'SCRIPT'
#!/bin/bash
echo "Parando Nexus Monitoramento..."
sudo systemctl stop nexus-analytics
sudo systemctl stop nexus-mediamtx
sudo systemctl stop nexus-auth
sudo systemctl stop nexus-postgrest
echo "Servicos parados."
SCRIPT

cat > "$INSTALL_DIR/status-nexus.sh" << 'SCRIPT'
#!/bin/bash
echo "========== STATUS NEXUS MONITORAMENTO =========="
echo ""
for svc in postgresql nginx nexus-postgrest nexus-auth nexus-mediamtx nexus-analytics; do
  STATUS=$(systemctl is-active "$svc" 2>/dev/null)
  if [ "$STATUS" = "active" ]; then
    echo -e "  \033[0;32m● $svc\033[0m"
  else
    echo -e "  \033[0;31m○ $svc ($STATUS)\033[0m"
  fi
done
echo ""
SCRIPT

cat > "$INSTALL_DIR/atualizar-nexus.sh" << SCRIPT
#!/bin/bash
echo ""
echo "============================================="
echo "  NEXUS MONITORAMENTO - Atualizacao"
echo "  (Dados e configuracoes locais preservados)"
echo "============================================="
echo ""
cd "$INSTALL_DIR"

echo "[1/7] Salvando configuracoes locais..."
cp -f .env .env.bak 2>/dev/null || true
cp -f auth-server/server.js auth-server/server.js.bak 2>/dev/null || true

echo "[2/7] Descartando alteracoes de codigo (nao dados)..."
git checkout -- . 2>/dev/null || true

echo "[3/7] Baixando atualizacoes do GitHub..."
git pull origin main

echo "[4/7] Restaurando configuracoes locais..."
cp -f .env.bak .env 2>/dev/null || true
cp -f auth-server/server.js.bak auth-server/server.js 2>/dev/null || true

echo "[5/7] Aplicando atualizacoes no banco de dados..."
if [ -f "installer/init-database.sql" ]; then
  sudo -u postgres psql -d nexus -f installer/init-database.sql > /dev/null 2>&1
  echo "  Schema do banco atualizado"
else
  echo "  init-database.sql nao encontrado, pulando"
fi

echo "[6/7] Instalando dependencias e gerando build..."
npm install --legacy-peer-deps
npm run build

echo "[7/7] Reiniciando servicos..."
sudo systemctl restart nexus-postgrest
sudo systemctl restart nexus-auth
sudo systemctl restart nginx

echo ""
echo "============================================="
echo "  ATUALIZACAO CONCLUIDA!"
echo "  Configuracoes locais preservadas."
echo "  Schema do banco atualizado."
echo "  Recarregue a pagina no navegador."
echo "============================================="
echo ""
SCRIPT

chmod +x "$INSTALL_DIR"/*.sh
ok "Scripts criados: iniciar/parar/status/atualizar-nexus.sh"

# ----------------------------------------------------------
# Resumo
# ----------------------------------------------------------
echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "   INSTALACAO CONCLUIDA!"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "  ${CYAN}COMPONENTES INSTALADOS:${NC}"
echo -e "  - PostgreSQL........: localhost:5432"
echo -e "  - PostgREST (API)...: localhost:$POSTGREST_PORT"
echo -e "  - Auth Server.......: localhost:$API_PORT"
echo -e "  - MediaMTX (Midia)..: RTMP :1935 | RTSP :8554 | HLS :8888"
echo -e "  - Nginx (Frontend)..: localhost:$PORT"
echo ""
echo -e "  ${CYAN}SERVIDOR DE MIDIA (MediaMTX):${NC}"
echo -e "  Enviar stream RTMP:"
echo -e "    rtmp://$LOCAL_IP:1935/{nome_camera}"
echo -e "  Enviar stream RTSP:"
echo -e "    rtsp://$LOCAL_IP:8554/{nome_camera}"
echo -e "  Assistir no browser (HLS):"
echo -e "    http://$LOCAL_IP:8888/{nome_camera}/"
echo ""
echo -e "  ${CYAN}ACESSO:${NC}"
echo -e "  URL:    http://$LOCAL_IP:$PORT"
echo -e "  Email:  $ADMIN_EMAIL"
echo -e "  Senha:  $ADMIN_PASSWORD"
echo ""
echo -e "  ${CYAN}SCRIPTS:${NC}"
echo -e "  Status:     sudo bash status-nexus.sh"
echo -e "  Iniciar:    sudo bash iniciar-nexus.sh"
echo -e "  Parar:      sudo bash parar-nexus.sh"
echo -e "  Atualizar:  bash atualizar-nexus.sh"
echo ""
echo -e "  ${CYAN}SERVICOS SYSTEMD:${NC}"
echo -e "  sudo systemctl status nexus-postgrest"
echo -e "  sudo systemctl status nexus-auth"
echo -e "  sudo systemctl status nexus-mediamtx"
echo ""
echo -e "  ${YELLOW}⚠️  Troque a senha do admin apos o primeiro login!${NC}"
echo ""
