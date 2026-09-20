#!/usr/bin/env bash
# enable-systemd-services.sh — enable+start the host-side services.
# The communication service itself is a container now (compose-up.sh);
# only coturn, haproxy and the cert-expiry timer are systemd units.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../lib/common.sh
source "${SCRIPT_DIR}/../../lib/common.sh"

EDGE_HAPROXY_ENABLED="${EDGE_HAPROXY_ENABLED:-true}"

UNITS=(coturn communication-cert-check.timer)
if [[ "${EDGE_HAPROXY_ENABLED}" == "true" ]]; then
  UNITS+=(haproxy)
fi

info "Enabling and starting: ${UNITS[*]}"
for unit in "${UNITS[@]}"; do
  systemctl enable "${unit}" >/dev/null 2>&1 || true
  systemctl restart "${unit}"
done
ok "Host services up"

