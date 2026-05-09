#!/usr/bin/env bash
# configure-ufw.sh — apply firewall rules for the communication server.
#
# Default policy: deny incoming, allow outgoing.
# Always-open: 22/tcp (SSH), 443/tcp (TLS), 3478/{udp,tcp} (STUN/TURN).
# When --no-haproxy is used coturn binds 5349/tcp publicly so we open
# that too; otherwise it stays loopback-only.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

EDGE_HAPROXY_ENABLED="${EDGE_HAPROXY_ENABLED:-true}"

info "Resetting default UFW policies"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null

ALLOW=(
  "22/tcp"
  "443/tcp"
  "3478/udp"
  "3478/tcp"
)
if [[ "${EDGE_HAPROXY_ENABLED}" != "true" ]]; then
  ALLOW+=("5349/tcp")
fi

for rule in "${ALLOW[@]}"; do
  ufw allow "${rule}" >/dev/null
  ok "ufw allow ${rule}"
done

ufw --force enable
ok "UFW active"
