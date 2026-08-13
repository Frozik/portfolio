#!/usr/bin/env bash
# render-renewal-hook.sh — drop the certbot renewal hooks.
# v2: deploy hook only reloads HAProxy + coturn. The communication
# service auto-detects the cert change via fs.watch (CertWatcher) and
# refreshes its TLS context in place — no SIGTERM, no drain, active
# Socket.IO sessions stay live across renewals.
# v3: pre/post hooks toggle UFW for port 80. The firewall denies :80 by
# default, which silently broke every automatic renewal (HTTP-01
# challenges timed out for a month until the cert expired on
# 2026-08-07). obtain-letsencrypt-cert.sh opens the port only for the
# initial issuance; unattended renewals need these hooks.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

DEPLOY_HOOK_PATH="/etc/letsencrypt/renewal-hooks/deploy/communication.sh"
PRE_HOOK_PATH="/etc/letsencrypt/renewal-hooks/pre/open-http-port.sh"
POST_HOOK_PATH="/etc/letsencrypt/renewal-hooks/post/close-http-port.sh"

mkdir -p "$(dirname "${DEPLOY_HOOK_PATH}")" "$(dirname "${PRE_HOOK_PATH}")" "$(dirname "${POST_HOOK_PATH}")"

info "Writing ${DEPLOY_HOOK_PATH}"
cat > "${DEPLOY_HOOK_PATH}" <<'HOOK'
#!/bin/sh
# Reload TLS-bearing services after certbot renewal. v2: communication
# auto-reloads its TLS context via fs.watch — no need to kill it.
set -eu
systemctl reload haproxy 2>/dev/null || systemctl restart haproxy
systemctl reload coturn  2>/dev/null || systemctl restart coturn
HOOK

info "Writing ${PRE_HOOK_PATH}"
cat > "${PRE_HOOK_PATH}" <<'HOOK'
#!/bin/sh
# HTTP-01 standalone challenge needs inbound :80; the firewall keeps it
# closed otherwise. Paired with post/close-http-port.sh.
set -eu
ufw allow 80/tcp >/dev/null
HOOK

info "Writing ${POST_HOOK_PATH}"
cat > "${POST_HOOK_PATH}" <<'HOOK'
#!/bin/sh
set -eu
ufw deny 80/tcp >/dev/null
HOOK

for hook in "${DEPLOY_HOOK_PATH}" "${PRE_HOOK_PATH}" "${POST_HOOK_PATH}"; do
  chmod 755 "${hook}"
  chown root:root "${hook}"
done
ok "Renewal hooks installed (deploy + ufw pre/post)"
