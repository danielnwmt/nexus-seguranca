#!/usr/bin/env bash
# Instalador independente do MediaMTX para Nexus Segurança.
# Uso: curl -fsSL URL_DO_SCRIPT | sudo bash
# Com SSL: curl -fsSL URL_DO_SCRIPT | sudo MEDIA_DOMAIN=mtx.seudominio.com bash

set -Eeuo pipefail

MEDIAMTX_VERSION="${MEDIAMTX_VERSION:-v1.12.3}"
MEDIAMTX_BIN="${MEDIAMTX_BIN:-/usr/local/bin/mediamtx}"
MEDIAMTX_CONFIG="${MEDIAMTX_CONFIG:-/usr/local/etc/mediamtx.yml}"
MEDIAMTX_USER="${MEDIAMTX_USER:-mediamtx}"
PUBLIC_API="${PUBLIC_API:-false}"
MEDIA_DOMAIN="${MEDIA_DOMAIN:-}"
SSL_EMAIL="${SSL_EMAIL:-}"
CERT_DIR="/usr/local/etc/mediamtx-certs"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${CYAN}>> $*${NC}"; }
ok() { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
fail() { echo -e "${RED}[X]${NC} $*" >&2; exit 1; }

on_error() {
  echo -e "${RED}[X] Falha na linha $1. Consulte: journalctl -u mediamtx -n 100${NC}" >&2
}
trap 'on_error $LINENO' ERR

if [[ "${EUID}" -ne 0 ]]; then
  fail "Execute como administrador: sudo bash install-mediamtx-ubuntu.sh"
fi

if [[ ! -f /etc/os-release ]]; then
  fail "Não foi possível identificar o sistema operacional."
fi

# shellcheck disable=SC1091
source /etc/os-release
if [[ "${ID:-}" != "ubuntu" ]]; then
  fail "Este instalador é exclusivo para Ubuntu. Sistema detectado: ${ID:-desconhecido}"
fi

case "$(uname -m)" in
  x86_64|amd64) MEDIAMTX_ARCH="amd64" ;;
  aarch64|arm64) MEDIAMTX_ARCH="arm64v8" ;;
  *) fail "Arquitetura não suportada: $(uname -m). Use amd64 ou arm64." ;;
esac

echo
echo -e "${CYAN}=============================================${NC}"
echo "   NEXUS SEGURANÇA — SERVIDOR MEDIAMTX"
echo "   Ubuntu ${VERSION_ID:-} | ${MEDIAMTX_VERSION}"
echo -e "${CYAN}=============================================${NC}"
echo

# Pergunta o domínio para SSL (necessário para o vídeo funcionar em sites HTTPS)
if [[ -z "$MEDIA_DOMAIN" && -r /dev/tty ]]; then
  echo -e "${YELLOW}Para o vídeo aparecer no sistema publicado (HTTPS), o MediaMTX precisa de SSL.${NC}"
  echo "Informe o domínio apontado para este servidor (ex: mtx.seudominio.com)."
  echo "Deixe em branco para instalar sem SSL (somente HTTP)."
  read -r -p "Domínio do MediaMTX: " MEDIA_DOMAIN < /dev/tty || true
fi

MEDIA_DOMAIN="$(echo "${MEDIA_DOMAIN:-}" | tr '[:upper:]' '[:lower:]' | sed -E 's#^https?://##; s#/.*$##; s/[^a-z0-9.-]//g')"
SSL_ENABLED="false"
if [[ -n "$MEDIA_DOMAIN" ]]; then
  SSL_ENABLED="true"
fi

info "Instalando dependências..."
export DEBIAN_FRONTEND=noninteractive

MISSING_PACKAGES=()
command -v curl >/dev/null 2>&1 || MISSING_PACKAGES+=(curl)
command -v tar >/dev/null 2>&1 || MISSING_PACKAGES+=(tar)
command -v ufw >/dev/null 2>&1 || MISSING_PACKAGES+=(ufw)
if [[ "$SSL_ENABLED" == "true" ]]; then
  command -v certbot >/dev/null 2>&1 || MISSING_PACKAGES+=(certbot)
fi

if (( ${#MISSING_PACKAGES[@]} > 0 )); then
  if fuser /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/lib/apt/lists/lock /var/cache/apt/archives/lock >/dev/null 2>&1; then
    fail "O apt está ocupado. Encerre a atualização do Ubuntu e execute novamente."
  fi
  apt-get -o DPkg::Lock::Timeout=0 update -qq
  apt-get -o DPkg::Lock::Timeout=0 install -y -qq ca-certificates "${MISSING_PACKAGES[@]}" >/dev/null
fi
ok "Dependências verificadas"

LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
LOCAL_IP="${LOCAL_IP:-127.0.0.1}"
PUBLIC_IP="$(curl -4fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
WEBRTC_HOST="${MEDIA_DOMAIN:-${PUBLIC_IP:-$LOCAL_IP}}"

if ! id "$MEDIAMTX_USER" >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "$MEDIAMTX_USER"
fi

if [[ "$SSL_ENABLED" == "true" ]]; then
  info "Gerando certificado SSL para ${MEDIA_DOMAIN}..."
  warn "O domínio ${MEDIA_DOMAIN} precisa estar apontado para o IP ${PUBLIC_IP:-deste servidor}."
  ufw allow 80/tcp comment "Certbot HTTP-01" >/dev/null 2>&1 || true

  CERTBOT_EMAIL_ARGS=(--register-unsafely-without-email)
  if [[ -n "$SSL_EMAIL" ]]; then
    CERTBOT_EMAIL_ARGS=(-m "$SSL_EMAIL")
  fi

  if ! certbot certonly --standalone --non-interactive --agree-tos \
      "${CERTBOT_EMAIL_ARGS[@]}" -d "$MEDIA_DOMAIN"; then
    fail "Não foi possível gerar o certificado. Confira o DNS de ${MEDIA_DOMAIN} e a porta 80 liberada."
  fi

  install -d -m 0750 -o root -g "$MEDIAMTX_USER" "$CERT_DIR" 2>/dev/null || install -d -m 0750 "$CERT_DIR"

  # Hook de renovação: copia os certificados e reinicia o MediaMTX
  install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
  cat > /etc/letsencrypt/renewal-hooks/deploy/mediamtx.sh <<EOF
#!/usr/bin/env bash
set -e
install -m 0640 -o root -g ${MEDIAMTX_USER} /etc/letsencrypt/live/${MEDIA_DOMAIN}/privkey.pem ${CERT_DIR}/privkey.pem
install -m 0640 -o root -g ${MEDIAMTX_USER} /etc/letsencrypt/live/${MEDIA_DOMAIN}/fullchain.pem ${CERT_DIR}/fullchain.pem
systemctl is-enabled mediamtx >/dev/null 2>&1 && systemctl restart mediamtx || true
EOF
  chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/mediamtx.sh
  bash /etc/letsencrypt/renewal-hooks/deploy/mediamtx.sh
  ok "Certificado SSL configurado (renovação automática ativa)"
fi

DOWNLOAD_URL="https://github.com/bluenviron/mediamtx/releases/download/${MEDIAMTX_VERSION}/mediamtx_${MEDIAMTX_VERSION}_linux_${MEDIAMTX_ARCH}.tar.gz"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

info "Baixando MediaMTX ${MEDIAMTX_VERSION}..."
curl -fL --retry 3 --connect-timeout 15 "$DOWNLOAD_URL" -o "$TMP_DIR/mediamtx.tar.gz"
tar -xzf "$TMP_DIR/mediamtx.tar.gz" -C "$TMP_DIR" mediamtx
install -m 0755 "$TMP_DIR/mediamtx" "$MEDIAMTX_BIN"
ok "MediaMTX instalado em $MEDIAMTX_BIN"

install -d -m 0755 "$(dirname "$MEDIAMTX_CONFIG")"
if [[ -f "$MEDIAMTX_CONFIG" ]]; then
  cp "$MEDIAMTX_CONFIG" "${MEDIAMTX_CONFIG}.backup.$(date +%Y%m%d%H%M%S)"
fi

API_ADDRESS="127.0.0.1:9997"
if [[ "$PUBLIC_API" == "true" ]]; then
  API_ADDRESS=":9997"
fi

TLS_BLOCK=""
if [[ "$SSL_ENABLED" == "true" ]]; then
  TLS_BLOCK="hlsServerKey: ${CERT_DIR}/privkey.pem
hlsServerCert: ${CERT_DIR}/fullchain.pem"
fi

WEBRTC_TLS_BLOCK=""
if [[ "$SSL_ENABLED" == "true" ]]; then
  WEBRTC_TLS_BLOCK="webrtcServerKey: ${CERT_DIR}/privkey.pem
webrtcServerCert: ${CERT_DIR}/fullchain.pem"
fi

cat > "$MEDIAMTX_CONFIG" <<EOF
# MediaMTX — Nexus Segurança
logLevel: info
logDestinations: [stdout]

api: yes
apiAddress: ${API_ADDRESS}

metrics: no

rtspAddress: :8554

rtmpAddress: :1935
rtmpEncryption: "no"

hlsAddress: :8888
hlsEncryption: ${SSL_ENABLED}
hlsAlwaysRemux: no
hlsSegmentCount: 3
hlsSegmentDuration: 1s
hlsPartDuration: 200ms
hlsSegmentMaxSize: 50M
hlsAllowOrigin: '*'
${TLS_BLOCK}

webrtcAddress: :8889
webrtcEncryption: ${SSL_ENABLED}
webrtcAllowOrigin: '*'
webrtcAdditionalHosts: [${WEBRTC_HOST}]
${WEBRTC_TLS_BLOCK}

paths:
  all_others:
EOF
chown root:"$MEDIAMTX_USER" "$MEDIAMTX_CONFIG"
chmod 0640 "$MEDIAMTX_CONFIG"
ok "Configuração criada para ${WEBRTC_HOST}"

cat > /etc/systemd/system/mediamtx.service <<EOF
[Unit]
Description=MediaMTX - Nexus Segurança
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${MEDIAMTX_USER}
Group=${MEDIAMTX_USER}
ExecStart=${MEDIAMTX_BIN} ${MEDIAMTX_CONFIG}
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=${CERT_DIR}

[Install]
WantedBy=multi-user.target
EOF

info "Configurando firewall..."
ufw allow 1935/tcp comment "MediaMTX RTMP" >/dev/null
ufw allow 8554/tcp comment "MediaMTX RTSP" >/dev/null
ufw allow 8888/tcp comment "MediaMTX HLS" >/dev/null
ufw allow 8889/tcp comment "MediaMTX WebRTC HTTP" >/dev/null
ufw allow 8189/udp comment "MediaMTX WebRTC UDP" >/dev/null
if [[ "$PUBLIC_API" == "true" ]]; then
  ufw allow 9997/tcp comment "MediaMTX API" >/dev/null
fi
ok "Portas configuradas"

info "Ativando serviço..."
systemctl daemon-reload
systemctl enable --now mediamtx >/dev/null
sleep 2

if ! systemctl is-active --quiet mediamtx; then
  systemctl status mediamtx --no-pager || true
  fail "O MediaMTX não iniciou."
fi

ok "MediaMTX instalado e em execução"
echo
if [[ "$SSL_ENABLED" == "true" ]]; then
  echo "PUBLICAR CÂMERA: rtmp://${MEDIA_DOMAIN}:1935/CHAVE_DA_CAMERA"
  echo "ASSISTIR POR HLS: https://${MEDIA_DOMAIN}:8888/CHAVE_DA_CAMERA/"
  echo "ASSISTIR POR WEBRTC: https://${MEDIA_DOMAIN}:8889/CHAVE_DA_CAMERA/"
else
  echo "PUBLICAR CÂMERA: rtmp://${WEBRTC_HOST}:1935/CHAVE_DA_CAMERA"
  echo "ASSISTIR POR HLS: http://${WEBRTC_HOST}:8888/CHAVE_DA_CAMERA/"
  echo "ASSISTIR POR WEBRTC: http://${WEBRTC_HOST}:8889/CHAVE_DA_CAMERA/"
fi
echo
echo "Status: sudo systemctl status mediamtx"
echo "Logs:   sudo journalctl -u mediamtx -f"
echo "Reiniciar: sudo systemctl restart mediamtx"
