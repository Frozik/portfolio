#!/usr/bin/env bash
# nav-expand-cert.sh — add the navigation hostname to the Let's Encrypt
# certificate and build the combined PEM HAProxy terminates TLS with.
# HTTP-01 needs :80 open for the exchange; the existing renewal hooks do
# exactly that, so they are reused here as pre/post hooks.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=nav-versions.sh
source "${SCRIPT_DIR}/nav-versions.sh"
# shellcheck disable=SC1091
source /etc/communication/deploy-vars
# shellcheck disable=SC1091
source "${NAV_VARS}"

LIVE="/etc/letsencrypt/live/communication"
PEM_DIR="/etc/haproxy/certs"
PEM="${PEM_DIR}/nav.pem"

build_pem() {
  mkdir -p "${PEM_DIR}"
  cat "${LIVE}/fullchain.pem" "${LIVE}/privkey.pem" > "${PEM}.tmp"
  chmod 600 "${PEM}.tmp"
  mv "${PEM}.tmp" "${PEM}"
}

if openssl x509 -in "${LIVE}/fullchain.pem" -noout -text | grep -q "DNS:${NAV_DOMAIN}"; then
  ok "Certificate already covers ${NAV_DOMAIN}"
else
  # The ACME account already exists from install.sh; an e-mail is only
  # needed to create one, so it is passed through when given.
  email_args=()
  if [[ -n "${CERT_EMAIL:-}" ]]; then
    email_args=(--email "${CERT_EMAIL}")
  fi
  info "Expanding certificate with ${NAV_DOMAIN} (HTTP-01 on :80)"
  certbot certonly --standalone \
    --preferred-challenges http \
    --non-interactive \
    --agree-tos \
    --no-eff-email \
    "${email_args[@]}" \
    --expand \
    --cert-name communication \
    --pre-hook /etc/letsencrypt/renewal-hooks/pre/open-http-port.sh \
    --post-hook /etc/letsencrypt/renewal-hooks/post/close-http-port.sh \
    -d "${COMMUNICATION_DOMAIN}" \
    -d "${TURN_DOMAIN}" \
    -d "${NAV_DOMAIN}"
  ok "Certificate expanded"
fi

build_pem
ok "HAProxy PEM: ${PEM}"
