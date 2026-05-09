#!/usr/bin/env bash
# enable-systemd-services.sh — enable+start coturn, haproxy, communication.
# Wait up to 30s for /health/live before declaring success.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

EDGE_HAPROXY_ENABLED="${EDGE_HAPROXY_ENABLED:-true}"
WAIT_SECONDS="${WAIT_SECONDS:-30}"

# Pull derived deploy vars (FASTIFY_PORT, FASTIFY_HOST, COMMUNICATION_DOMAIN)
# from the file render-toml-configs.sh wrote.
if [[ -f /etc/communication/deploy-vars ]]; then
  # shellcheck disable=SC1091
  source /etc/communication/deploy-vars
fi
FASTIFY_PORT="${FASTIFY_PORT:-8443}"
FASTIFY_HOST="${FASTIFY_HOST:-127.0.0.1}"

# In production TLS is on. Hit the loopback HTTPS endpoint with -k since
# the cert CN is the sslip.io hostname, not 127.0.0.1.
HEALTH_URL="https://127.0.0.1:${FASTIFY_PORT}/health/live"
CURL_OPTS="-fsSk --max-time 2"

UNITS=(coturn communication communication-cert-check.timer)
if [[ "${EDGE_HAPROXY_ENABLED}" == "true" ]]; then
  UNITS+=(haproxy)
fi

info "Enabling and starting: ${UNITS[*]}"
for unit in "${UNITS[@]}"; do
  systemctl enable "${unit}" >/dev/null 2>&1 || true
  systemctl restart "${unit}"
done

info "Waiting up to ${WAIT_SECONDS}s for ${HEALTH_URL}"
deadline=$(( $(date +%s) + WAIT_SECONDS ))
while (( $(date +%s) < deadline )); do
  # shellcheck disable=SC2086
  if curl ${CURL_OPTS} "${HEALTH_URL}" >/dev/null 2>&1; then
    ok "Communication is healthy"
    exit 0
  fi
  sleep 1
done
die "Communication failed health check at ${HEALTH_URL}. Run: journalctl -u communication -n 100"
