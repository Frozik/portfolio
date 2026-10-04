#!/usr/bin/env bash
# smoke-test.sh — verify all expected services are active and the
# communication HTTP endpoints answer 200.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../lib/common.sh
source "${SCRIPT_DIR}/../../lib/common.sh"

EDGE_HAPROXY_ENABLED="${EDGE_HAPROXY_ENABLED:-true}"

if [[ -f /etc/communication/deploy-vars ]]; then
  # shellcheck disable=SC1091
  source /etc/communication/deploy-vars
fi
FASTIFY_PORT="${FASTIFY_PORT:-8443}"

UNITS=(coturn)
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

COMPOSE_FILE="/opt/communication/docker-compose.yml"
state="$(docker compose -f "${COMPOSE_FILE}" ps --format '{{.State}}' communication 2>/dev/null || true)"
if [[ "${state}" == "running" ]]; then
  ok "container communication running"
else
  die "container communication is '${state:-missing}'. docker compose -f ${COMPOSE_FILE} logs communication"
fi

LIVE_URL="https://127.0.0.1:${FASTIFY_PORT}/health/live"
READY_URL="https://127.0.0.1:${FASTIFY_PORT}/health/ready"

WAIT_SECONDS="${WAIT_SECONDS:-45}"
info "Waiting up to ${WAIT_SECONDS}s for ${LIVE_URL}"
deadline=$(( $(date +%s) + WAIT_SECONDS ))
until curl -fsSk --max-time 3 "${LIVE_URL}" >/dev/null 2>&1; do
  if (( $(date +%s) >= deadline )); then
    die "/health/live did not answer within ${WAIT_SECONDS}s. docker compose -f ${COMPOSE_FILE} logs communication"
  fi
  sleep 2
done
ok "/health/live -> 200"

info "GET ${READY_URL}"
if curl -fsSk --max-time 5 "${READY_URL}" >/dev/null; then
  ok "/health/ready -> 200"
else
  warn "/health/ready did not return 200 — JWKS may still be warming up"
fi

info "GET ${LIVE_URL%/health/live}/transport as a WebSocket upgrade"
upgrade_status="$(curl -sk --http1.1 --max-time 3 -o /dev/null -w '%{http_code}' \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
  "https://127.0.0.1:${FASTIFY_PORT}/transport" || true)"
if [[ "${upgrade_status}" == "101" ]]; then
  ok "transport WebSocket fallback -> 101"
else
  die "transport WebSocket fallback answered '${upgrade_status}'. docker compose -f ${COMPOSE_FILE} logs communication"
fi

http3_binding="$(docker compose -f "${COMPOSE_FILE}" port --protocol udp communication 4447 2>/dev/null || true)"
if [[ -n "${http3_binding}" ]]; then
  ok "transport HTTP/3 published on udp ${http3_binding}"
else
  die "transport HTTP/3 port 4447/udp is not published. Check docker-compose.yml"
fi
