#!/usr/bin/env bash
# graceful-restart.sh — SIGTERM + 16s drain + start, then health-check.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

DRAIN_SECONDS="${DRAIN_SECONDS:-16}"
HEALTH_PORT="${HEALTH_PORT:-4445}"
HEALTH_URL="http://127.0.0.1:${HEALTH_PORT}/health/live"
WAIT_SECONDS="${WAIT_SECONDS:-30}"

info "Sending SIGTERM to communication"
systemctl kill -s SIGTERM communication
info "Draining for ${DRAIN_SECONDS}s"
sleep "${DRAIN_SECONDS}"
info "Starting communication"
systemctl start communication

info "Waiting up to ${WAIT_SECONDS}s for ${HEALTH_URL}"
deadline=$(( $(date +%s) + WAIT_SECONDS ))
while (( $(date +%s) < deadline )); do
  if curl -fsS --max-time 2 "${HEALTH_URL}" >/dev/null 2>&1; then
    ok "Communication healthy after restart"
    exit 0
  fi
  sleep 1
done
die "Service did not become healthy. journalctl -u communication -n 100"
