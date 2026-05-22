#!/usr/bin/env bash
# graceful-restart.sh — SIGTERM + 16s drain + start, then health-check.
#
# The health-check uses the same port/protocol detection as
# `smoke-test.sh`: `FASTIFY_PORT` from `/etc/communication/deploy-vars`
# (default 8443) over HTTPS with `-k` (the cert CN is the sslip.io
# hostname, not 127.0.0.1). Without this, the check defaults that used
# to live here (HTTP, port 4445) miss the actual TLS listener that
# `production.toml` configures and always fail post-restart.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

DRAIN_SECONDS="${DRAIN_SECONDS:-16}"
WAIT_SECONDS="${WAIT_SECONDS:-30}"

if [[ -f /etc/communication/deploy-vars ]]; then
  # shellcheck disable=SC1091
  source /etc/communication/deploy-vars
fi
FASTIFY_PORT="${FASTIFY_PORT:-8443}"
HEALTH_URL="https://127.0.0.1:${FASTIFY_PORT}/health/live"

info "Sending SIGTERM to communication"
systemctl kill -s SIGTERM communication
info "Draining for ${DRAIN_SECONDS}s"
sleep "${DRAIN_SECONDS}"
info "Starting communication"
systemctl start communication

info "Waiting up to ${WAIT_SECONDS}s for ${HEALTH_URL}"
deadline=$(( $(date +%s) + WAIT_SECONDS ))
while (( $(date +%s) < deadline )); do
  # -k: cert CN is the public sslip.io hostname, not 127.0.0.1.
  if curl -fsSk --max-time 2 "${HEALTH_URL}" >/dev/null 2>&1; then
    ok "Communication healthy after restart"
    exit 0
  fi
  sleep 1
done
die "Service did not become healthy. journalctl -u communication -n 100"
