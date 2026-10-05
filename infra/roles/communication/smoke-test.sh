#!/usr/bin/env bash
# smoke-test.sh — verify all expected services are active, the
# communication HTTP endpoints answer 200 and the HTTP/3 gateway is up.
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
for service in communication gateway; do
  state="$(docker compose -f "${COMPOSE_FILE}" ps --format '{{.State}}' "${service}" 2>/dev/null || true)"
  if [[ "${state}" == "running" ]]; then
    ok "container ${service} running"
  else
    die "container ${service} is '${state:-missing}'. docker compose -f ${COMPOSE_FILE} logs ${service}"
  fi
done

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

http3_binding="$(docker compose -f "${COMPOSE_FILE}" port --protocol udp gateway 4447 2>/dev/null || true)"
if [[ -n "${http3_binding}" ]]; then
  ok "HTTP/3 gateway published on udp ${http3_binding}"
else
  die "HTTP/3 gateway port 4447/udp is not published. Check ${COMPOSE_FILE}"
fi

info "Waiting up to ${WAIT_SECONDS}s for the gateway's health check"
deadline=$(( $(date +%s) + WAIT_SECONDS ))
until docker compose -f "${COMPOSE_FILE}" exec -T gateway /gateway -healthcheck >/dev/null 2>&1; do
  if (( $(date +%s) >= deadline )); then
    die "the gateway did not turn healthy within ${WAIT_SECONDS}s. docker compose -f ${COMPOSE_FILE} logs gateway"
  fi
  sleep 2
done
ok "HTTP/3 gateway healthy"

info "GET the gateway listener from inside the network"
listener_status="$(docker compose -f "${COMPOSE_FILE}" exec -T communication \
  node -e "require('http').get('http://127.0.0.1:4448/transport',r=>{console.log(r.statusCode);process.exit(0)}).on('error',()=>{console.log('down');process.exit(0)})" \
  2>/dev/null || true)"
if [[ "${listener_status}" == "426" ]]; then
  ok "gateway listener answers inside the network (426 to a plain GET)"
else
  die "the gateway listener on 4448 does not answer. docker compose -f ${COMPOSE_FILE} logs communication"
fi
