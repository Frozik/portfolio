#!/usr/bin/env bash
# render-renewal-hook.sh — drop a deploy-hook executed by certbot on
# successful renewal. v2: only reloads HAProxy + coturn. The communication
# service auto-detects the cert change via fs.watch (CertWatcher) and
# refreshes its TLS context in place — no SIGTERM, no drain, active
# Socket.IO sessions stay live across renewals.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

HOOK_DIR="/etc/letsencrypt/renewal-hooks/deploy"
HOOK_PATH="${HOOK_DIR}/communication.sh"

mkdir -p "${HOOK_DIR}"
info "Writing ${HOOK_PATH}"
cat > "${HOOK_PATH}" <<'HOOK'
#!/bin/sh
# Reload TLS-bearing services after certbot renewal. v2: communication
# auto-reloads its TLS context via fs.watch — no need to kill it.
set -eu
systemctl reload haproxy 2>/dev/null || systemctl restart haproxy
systemctl reload coturn  2>/dev/null || systemctl restart coturn
HOOK
chmod 755 "${HOOK_PATH}"
chown root:root "${HOOK_PATH}"
ok "Renewal hook installed"
