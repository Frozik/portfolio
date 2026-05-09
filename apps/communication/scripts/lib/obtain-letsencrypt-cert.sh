#!/usr/bin/env bash
# obtain-letsencrypt-cert.sh — issue or refresh a Let's Encrypt cert that
# covers both the app domain and the TURN domain.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

# shellcheck disable=SC1091
source /etc/communication/deploy-vars
require_env CERT_EMAIL

CERT_PATH="/etc/letsencrypt/live/communication/fullchain.pem"

if [[ -f "${CERT_PATH}" ]]; then
  ok "Certificate already exists at ${CERT_PATH}"
  exit 0
fi

# v2: DNS sanity check. sslip.io is a third-party service; if it is
# transiently down, certbot will fail with an opaque ACME error. Fail
# fast with a more actionable message.
info "Verifying DNS for ${COMMUNICATION_DOMAIN}"
if ! command -v dig >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq dnsutils >/dev/null
fi
RESOLVED_IP="$(dig +short "${COMMUNICATION_DOMAIN}" | head -1 || true)"
if [[ -z "${RESOLVED_IP}" ]]; then
  die "DNS resolution for ${COMMUNICATION_DOMAIN} failed; sslip.io may be unavailable, or your --domain is incorrect. To use a self-hosted domain: pass --domain my.example.com after creating an A record pointing at this server's public IP."
fi
ok "Resolved ${COMMUNICATION_DOMAIN} -> ${RESOLVED_IP}"

info "Opening port 80 for ACME HTTP-01 challenge"
ufw allow 80/tcp >/dev/null

# Stop services that may bind :80 transiently (none of ours should, but
# be defensive in case haproxy was already started).
systemctl stop haproxy 2>/dev/null || true

info "Requesting cert for ${COMMUNICATION_DOMAIN} + ${TURN_DOMAIN}"
certbot certonly --standalone \
  --preferred-challenges http \
  --non-interactive \
  --agree-tos \
  --no-eff-email \
  --email "${CERT_EMAIL}" \
  -d "${COMMUNICATION_DOMAIN}" \
  -d "${TURN_DOMAIN}" \
  --cert-name communication

info "Closing port 80"
ufw deny 80/tcp >/dev/null

# Grant the `communication` system user read access to the cert
# directories. Default certbot perms are 0700 root:root on
# /etc/letsencrypt/{live,archive} which blocks our service from reading
# the cert files at runtime. Use ACLs (granular, no chmod weakening) +
# default ACL for inheritance so future renewals keep the access.
if ! command -v setfacl >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq acl >/dev/null
fi
# Both `communication` (Fastify TLS) and `turnserver` (coturn TURNS)
# need to read the cert at runtime.
for sysuser in communication turnserver; do
  if id -u "${sysuser}" >/dev/null 2>&1; then
    setfacl -R -m u:"${sysuser}":rX /etc/letsencrypt/live
    setfacl -R -m u:"${sysuser}":rX /etc/letsencrypt/archive
    setfacl -d -R -m u:"${sysuser}":rX /etc/letsencrypt/live
    setfacl -d -R -m u:"${sysuser}":rX /etc/letsencrypt/archive
  else
    warn "User ${sysuser} not present yet — skipping ACL grant"
  fi
done
ok "Granted communication+turnserver read ACL on /etc/letsencrypt/{live,archive}"

ok "Certificate issued: ${CERT_PATH}"
