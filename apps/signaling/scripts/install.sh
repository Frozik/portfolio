#!/usr/bin/env bash
# install.sh — one-shot installer for the y-webrtc signaling server.
#
# Target: fresh Ubuntu 22.04 / 24.04 with public IPv4.
# Run as root:
#   curl -fsSL https://raw.githubusercontent.com/frozik/portfolio/main/apps/signaling/scripts/install.sh | sudo bash
# or (after clone):
#   sudo bash apps/signaling/scripts/install.sh
#
# Handles: Node 22, pnpm, signaling system user, git clone, build, systemd
# unit, UFW, nginx, Let's Encrypt cert for <IP>.sslip.io.
#
# Idempotent: re-running skips already-done steps. The only destructive
# path is when /opt/signaling contains orphan dotfiles — those are
# wiped on clone (never touches an existing .git).

set -euo pipefail

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
REPO_URL="https://github.com/frozik/portfolio.git"
SIGNALING_USER="signaling"
SIGNALING_HOME="/opt/signaling"
SIGNALING_APP_DIR="${SIGNALING_HOME}/apps/signaling"
NODE_MAJOR="22"
PNPM_VERSION="10.14.0"
SERVICE_NAME="webrtc-signaling"
SERVICE_PORT="4444"
HTTPS_PORT="8443"
NGINX_SITE="webrtc-signaling"

# -----------------------------------------------------------------------------
# Output helpers
# -----------------------------------------------------------------------------
if [[ -t 1 ]]; then
  BLUE=$'\033[0;34m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; RED=$'\033[0;31m'; RESET=$'\033[0m'
else
  BLUE=''; GREEN=''; YELLOW=''; RED=''; RESET=''
fi

info()  { printf '%s▸%s %s\n' "${BLUE}" "${RESET}" "$*"; }
ok()    { printf '%s✓%s %s\n' "${GREEN}" "${RESET}" "$*"; }
warn()  { printf '%s!%s %s\n' "${YELLOW}" "${RESET}" "$*"; }
err()   { printf '%s✗%s %s\n' "${RED}" "${RESET}" "$*" >&2; }
die()   { err "$*"; exit 1; }

confirm() {
  local reply
  read -r -p "$1 [y/N] " reply </dev/tty
  [[ "${reply}" =~ ^[Yy]$ ]]
}

prompt() {
  local text="$1" default="${2:-}" reply
  if [[ -n "${default}" ]]; then
    read -r -p "${text} [${default}] " reply </dev/tty
    printf '%s' "${reply:-${default}}"
  else
    read -r -p "${text} " reply </dev/tty
    printf '%s' "${reply}"
  fi
}

# -----------------------------------------------------------------------------
# Steps
# -----------------------------------------------------------------------------
step_root_check() {
  if [[ $EUID -ne 0 ]]; then
    die "Run as root: sudo bash $0"
  fi
}

step_apt_update() {
  info "apt update"
  apt-get update -qq
  apt-get install -y -qq curl ca-certificates git
}

step_node() {
  info "Checking Node.js ${NODE_MAJOR}"
  if command -v node >/dev/null 2>&1; then
    local current
    current="$(node --version | sed 's/^v\([0-9]*\).*/\1/')"
    if [[ "${current}" -ge "${NODE_MAJOR}" ]]; then
      ok "Node $(node --version) is already installed"
      return
    fi
    warn "Found Node $(node --version) — upgrading to ${NODE_MAJOR}.x"
    apt-get remove -y -qq nodejs libnode-dev 2>/dev/null || true
    apt-get autoremove -y -qq
  fi
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
  ok "Node $(node --version) installed"
}

step_pnpm() {
  info "Checking pnpm"
  if command -v pnpm >/dev/null 2>&1; then
    ok "pnpm $(pnpm --version) is already installed"
    return
  fi
  corepack enable
  corepack prepare "pnpm@${PNPM_VERSION}" --activate
  ok "pnpm $(pnpm --version) installed"
}

step_user() {
  info "Setting up user '${SIGNALING_USER}'"
  if id "${SIGNALING_USER}" >/dev/null 2>&1; then
    ok "User ${SIGNALING_USER} already exists"
  else
    useradd \
      --system \
      --home-dir "${SIGNALING_HOME}" \
      --shell /bin/bash \
      "${SIGNALING_USER}"
    ok "User ${SIGNALING_USER} created"
  fi
  mkdir -p "${SIGNALING_HOME}"
  chown "${SIGNALING_USER}:${SIGNALING_USER}" "${SIGNALING_HOME}"
}

step_clone() {
  info "Cloning repository"
  if [[ -d "${SIGNALING_HOME}/.git" ]]; then
    ok "Repository already cloned"
    return
  fi
  # Wipe stray dotfiles (skeleton from a prior useradd --create-home etc.)
  find "${SIGNALING_HOME}" -mindepth 1 -delete
  sudo -u "${SIGNALING_USER}" -H git clone "${REPO_URL}" "${SIGNALING_HOME}"
  ok "Cloned into ${SIGNALING_HOME}"
}

step_install_and_build() {
  info "Installing dependencies and building the signaling server"
  sudo -u "${SIGNALING_USER}" -H bash -c \
    "cd '${SIGNALING_HOME}' && pnpm install --frozen-lockfile"
  sudo -u "${SIGNALING_USER}" -H bash -c \
    "cd '${SIGNALING_HOME}' && pnpm --filter @frozik/signaling run build"
  ok "Build ready: ${SIGNALING_APP_DIR}/dist/server.js"
}

step_systemd() {
  info "Configuring systemd unit"
  cat >"/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=y-webrtc signaling server
After=network.target

[Service]
Type=simple
User=${SIGNALING_USER}
WorkingDirectory=${SIGNALING_APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${SERVICE_PORT}
ExecStart=/usr/bin/node ${SIGNALING_APP_DIR}/dist/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now "${SERVICE_NAME}"
  ok "Service ${SERVICE_NAME} is running"
}

step_ufw() {
  info "Configuring UFW"
  if ! command -v ufw >/dev/null 2>&1; then
    warn "UFW is not installed — skipping"
    return
  fi
  # 80 for Let's Encrypt HTTP-01 renewals, HTTPS_PORT for WSS.
  local want_ports=(22 80 "${HTTPS_PORT}")
  for port in "${want_ports[@]}"; do
    if ufw status | grep -Eq "^${port}/tcp[[:space:]]+ALLOW"; then
      continue
    fi
    ufw allow "${port}/tcp" >/dev/null
  done
  if ! ufw status | grep -q "Status: active"; then
    if confirm "UFW is disabled. Enable it now (SSH port 22 is already in the rules)"; then
      ufw --force enable
    fi
  fi
  ok "UFW configured"
}

step_detect_ip() {
  info "Detecting public IP"
  local detected
  detected="$(curl -fsS -4 --max-time 5 https://ifconfig.me 2>/dev/null || true)"
  if [[ -n "${detected}" ]]; then
    ok "Detected IP: ${detected}"
  fi
  PUBLIC_IP="$(prompt 'Server IP (for domain <IP>.sslip.io):' "${detected}")"
  if [[ -z "${PUBLIC_IP}" ]]; then
    die "IP is not set"
  fi
  DOMAIN="${PUBLIC_IP}.sslip.io"
  ok "Using domain: ${DOMAIN}"
}

step_nginx_install() {
  info "Installing nginx and certbot"
  if ! command -v nginx >/dev/null 2>&1; then
    apt-get install -y -qq nginx
  fi
  if ! command -v certbot >/dev/null 2>&1; then
    apt-get install -y -qq certbot python3-certbot-nginx
  fi
  rm -f "/etc/nginx/sites-enabled/default"
}

step_cert() {
  info "Obtaining TLS certificate for ${DOMAIN}"
  local cert_path="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
  if [[ -f "${cert_path}" ]]; then
    ok "Certificate already exists: ${cert_path}"
    return
  fi
  local email
  email="$(prompt 'Email for Lets Encrypt (used for recovery and renewal notices):' '')"
  if [[ -z "${email}" ]]; then
    die "Email is required"
  fi
  systemctl stop nginx 2>/dev/null || true
  certbot certonly --standalone \
    --preferred-challenges http \
    -d "${DOMAIN}" \
    --email "${email}" \
    --agree-tos --no-eff-email --non-interactive
  ok "Certificate obtained"
}

step_nginx_config() {
  info "Writing final nginx config"
  cat >"/etc/nginx/sites-available/${NGINX_SITE}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    return 301 https://\$host:${HTTPS_PORT}\$request_uri;
}

server {
    listen ${HTTPS_PORT} ssl http2;
    listen [::]:${HTTPS_PORT} ssl http2;
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # WS idle timeouts (client pings every 30s, 1h with headroom).
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;

    location / {
        proxy_pass http://127.0.0.1:${SERVICE_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header Origin \$http_origin;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
  ln -sf "/etc/nginx/sites-available/${NGINX_SITE}" "/etc/nginx/sites-enabled/${NGINX_SITE}"
  nginx -t
  systemctl restart nginx
  ok "nginx serves HTTPS on :${HTTPS_PORT} and proxies WebSocket to 127.0.0.1:${SERVICE_PORT}"
}

step_verify() {
  info "Checking /health"
  sleep 1
  local body
  body="$(curl -fsS --max-time 5 "https://${DOMAIN}:${HTTPS_PORT}/health" 2>/dev/null || true)"
  if [[ -n "${body}" ]]; then
    ok "https://${DOMAIN}:${HTTPS_PORT}/health → ${body}"
  else
    warn "Could not reach /health from this host — could be hairpin-NAT."
    warn "Check from another device: curl https://${DOMAIN}:${HTTPS_PORT}/health"
  fi
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
  step_root_check
  step_apt_update
  step_node
  step_pnpm
  step_user
  step_clone
  step_install_and_build
  step_systemd
  step_ufw
  step_detect_ip
  step_nginx_install
  step_cert
  step_nginx_config
  step_verify

  echo
  ok "Installation complete."
  echo
  echo "WebSocket URL for the portfolio:"
  echo "  wss://${DOMAIN}:${HTTPS_PORT}"
  echo
  echo "Add this to apps/portfolio/.env.local on the portfolio machine:"
  echo "  VITE_RETRO_SIGNALING_URLS=wss://${DOMAIN}:${HTTPS_PORT}"
  echo
  echo "Future upgrades:"
  echo "  sudo bash ${SIGNALING_APP_DIR}/scripts/upgrade.sh"
}

main "$@"
