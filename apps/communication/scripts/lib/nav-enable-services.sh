#!/usr/bin/env bash
# nav-enable-services.sh — start the tile server and the router, reload
# HAProxy with the navigation frontend, then apply the memory gate (R14):
# the box must keep at least 1 GB free with everything running.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=nav-versions.sh
source "${SCRIPT_DIR}/nav-versions.sh"
# shellcheck disable=SC1091
source "${NAV_VARS}"

MIN_FREE_MB="${NAV_MIN_FREE_MB:-1024}"
WAIT_SECONDS="${WAIT_SECONDS:-90}"

for unit in pmtiles graphhopper; do
  systemctl enable "${unit}" >/dev/null 2>&1 || true
  systemctl restart "${unit}"
done
haproxy -c -f /etc/haproxy/haproxy.cfg >/dev/null
systemctl reload haproxy

info "Waiting up to ${WAIT_SECONDS}s for GraphHopper to load the graph"
deadline=$(( $(date +%s) + WAIT_SECONDS ))
until curl -fsS --max-time 2 "http://127.0.0.1:${GRAPHHOPPER_PORT}/health" >/dev/null 2>&1; do
  (( $(date +%s) < deadline )) || die "GraphHopper did not become healthy: journalctl -u graphhopper -n 50"
  sleep 2
done

for unit in communication pmtiles graphhopper coturn redis-server; do
  rss="$(systemctl show "${unit}" -p MemoryCurrent --value 2>/dev/null || echo 0)"
  printf '  %-14s %6d MB\n' "${unit}" "$(( rss / 1048576 ))"
done
available="$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)"
info "MemAvailable: ${available} MB"
if (( available < MIN_FREE_MB )); then
  systemctl stop graphhopper
  systemctl disable graphhopper >/dev/null 2>&1 || true
  die "Only ${available} MB left; GraphHopper stopped and disabled. Lower its heap in nav-render-units.sh or drop a profile before enabling it again."
fi
ok "Navigation services up, ${available} MB available"
