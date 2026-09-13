#!/usr/bin/env bash
# Instalador independente do MediaMTX para Nexus Segurança.
# Uso: curl -fsSL URL_DO_SCRIPT | sudo bash

set -Eeuo pipefail

MEDIAMTX_VERSION="${MEDIAMTX_VERSION:-v1.9.3}"
MEDIAMTX_BIN="${MEDIAMTX_BIN:-/usr/local/bin/mediamtx}"
MEDIAMTX_CONFIG="${MEDIAMTX_CONFIG:-/usr/local/etc/mediamtx.yml}"
MEDIAMTX_USER="${MEDIAMTX_USER:-mediamtx}"
PUBLIC_API="${PUBLIC_API:-false}"

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

info "Instalando dependências..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl tar ufw >/dev/null
ok "Dependências instaladas"

LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
LOCAL_IP="${LOCAL_IP:-127.0.0.1}"
PUBLIC_IP="$(curl -4fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
WEBRTC_HOST="${PUBLIC_IP:-$LOCAL_IP}"

DOWNLOAD_URL="https://github.com/bluenviron/mediamtx/releases/download/${MEDIAMTX_VERSION}/mediamtx_${MEDIAMTX_VERSION}_linux_${MEDIAMTX_ARCH}.tar.gz"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

info "Baixando MediaMTX ${MEDIAMTX_VERSION}..."
curl -fL --retry 3 --connect-timeout 15 "$DOWNLOAD_URL" -o "$TMP_DIR/mediamtx.tar.gz"
tar -xzf "$TMP_DIR/mediamtx.tar.gz" -C "$TMP_DIR" mediamtx
install -m 0755 "$TMP_DIR/mediamtx" "$MEDIAMTX_BIN"
ok "MediaMTX instalado em $MEDIAMTX_BIN"

if ! id "$MEDIAMTX_USER" >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "$MEDIAMTX_USER"
fi

install -d -m 0755 "$(dirname "$MEDIAMTX_CONFIG")"
if [[ -f "$MEDIAMTX_CONFIG" ]]; then
  cp "$MEDIAMTX_CONFIG" "${MEDIAMTX_CONFIG}.backup.$(date +%Y%m%d%H%M%S)"
fi

API_ADDRESS="127.0.0.1:9997"
if [[ "$PUBLIC_API" == "true" ]]; then
  API_ADDRESS=":9997"
fi

cat > "$MEDIAMTX_CONFIG" <<EOF
# MediaMTX — Nexus Segurança
logLevel: info
logDestinations: [stdout]

api: yes
apiAddress: ${API_ADDRESS}

metrics: no

rtspAddress: :8554
rtspServerKey: ""
rtspServerCert: ""

rtmpAddress: :1935
rtmpEncryption: "no"

hlsAddress: :8888
hlsEncryption: no
hlsAlwaysRemux: no
hlsSegmentCount: 3
hlsSegmentDuration: 1s
hlsPartDuration: 200ms
hlsSegmentMaxSize: 50M
hlsAllowOrigin: '*'

webrtcAddress: :8889
webrtcEncryption: no
webrtcAllowOrigin: '*'
webrtcICEUDPServerIPs: [${WEBRTC_HOST}]

paths:
  all_others:
EOF
chown root:"$MEDIAMTX_USER" "$MEDIAMTX_CONFIG"
chmod 0640 "$MEDIAMTX_CONFIG"
ok "Configuração criada para o IP ${WEBRTC_HOST}"

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
echo "PUBLICAR CÂMERA: rtmp://${WEBRTC_HOST}:1935/CHAVE_DA_CAMERA"
echo "ASSISTIR POR HLS: http://${WEBRTC_HOST}:8888/CHAVE_DA_CAMERA/"
echo "ASSISTIR POR WEBRTC: http://${WEBRTC_HOST}:8889/CHAVE_DA_CAMERA/"
echo
echo "Status: sudo systemctl status mediamtx"
echo "Logs:   sudo journalctl -u mediamtx -f"
echo "Reiniciar: sudo systemctl restart mediamtx"