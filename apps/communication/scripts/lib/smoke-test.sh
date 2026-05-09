#!/usr/bin/env bash
# smoke-test.sh — verify all expected services are active and the
# communication HTTP endpoints answer 200.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

EDGE_HAPROXY_ENABLED="${EDGE_HAPROXY_ENABLED:-true}"

if [[ -f /etc/communication/deploy-vars ]]; then
  # shellcheck disable=SC1091
  source /etc/communication/deploy-vars
fi
FASTIFY_PORT="${FASTIFY_PORT:-8443}"

UNITS=(coturn communication)
if [[ "${EDGE_HAPROXY_ENABLED}" == "true" ]]; then
  UNITS+=(haproxy)
fi

for unit in "${UNITS[@]}"; do
  if systemctl is-active --quiet "${unit}"; then
    ok "${unit} active"
  else
    die "${unit} not active. journalctl -u ${unit} -n 50"
  fi
done

LIVE_URL="https://127.0.0.1:${FASTIFY_PORT}/health/live"
READY_URL="https://127.0.0.1:${FASTIFY_PORT}/health/ready"

info "GET ${LIVE_URL}"
# -k: cert CN is the public sslip.io hostname, not 127.0.0.1.
curl -fsSk --max-time 5 "${LIVE_URL}" >/dev/null
ok "/health/live -> 200"

info "GET ${READY_URL}"
if curl -fsSk --max-time 5 "${READY_URL}" >/dev/null; then
  ok "/health/ready -> 200"
else
  warn "/health/ready did not return 200 — JWKS may still be warming up"
fi
