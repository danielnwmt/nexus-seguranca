#!/usr/bin/env bash
# Instalador do servidor WhatsApp (Evolution API) — Nexus Segurança
# Uso: curl -fsSL URL | sudo WA_DOMAIN=wa.seudominio.com bash
set -Eeuo pipefail

WA_DOMAIN="${WA_DOMAIN:-}"
WA_DIR="/opt/nexus-whatsapp"
API_KEY="${WA_API_KEY:-$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)}"

[[ $EUID -eq 0 ]] || { echo "Execute com sudo"; exit 1; }

if [[ -z "$WA_DOMAIN" && -r /dev/tty ]]; then
  read -r -p "Domínio do WhatsApp (ex: wa.seudominio.com): " WA_DOMAIN < /dev/tty || true
fi
[[ -n "$WA_DOMAIN" ]] || { echo "Domínio obrigatório (o sistema usa HTTPS)."; exit 1; }

export DEBIAN_FRONTEND=noninteractive
command -v docker >/dev/null 2>&1 || curl -fsSL https://get.docker.com | sh
command -v caddy >/dev/null 2>&1 || {
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gpg >/dev/null
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
}

mkdir -p "$WA_DIR"
cat > "$WA_DIR/docker-compose.yml" <<EOF
services:
  evolution:
    image: atendai/evolution-api:v2.2.3
    restart: always
    ports: ["127.0.0.1:8080:8080"]
    environment:
      SERVER_URL: https://${WA_DOMAIN}
      AUTHENTICATION_API_KEY: ${API_KEY}
      CORS_ORIGIN: "*"
      DATABASE_ENABLED: "false"
      CACHE_LOCAL_ENABLED: "true"
    volumes: ["evolution_instances:/evolution/instances"]
volumes:
  evolution_instances:
EOF
docker compose -f "$WA_DIR/docker-compose.yml" up -d

cat > /etc/caddy/Caddyfile <<EOF
${WA_DOMAIN} {
  reverse_proxy 127.0.0.1:8080
}
EOF
command -v ufw >/dev/null && { ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; } || true
systemctl restart caddy

echo
echo "[OK] Servidor WhatsApp instalado"
echo "URL da API:   https://${WA_DOMAIN}"
echo "Chave da API: ${API_KEY}"
echo "Cole esses dados em Configurações → Chatbot → Conexão WhatsApp e clique em Gerar QR Code."
