#!/usr/bin/env bash
# nav-enable-services.sh — start the tile server and nginx, reload HAProxy
# with the navigation frontend, report memory and check that only the
# expected loopback listeners appeared (the port table in the plan).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=nav-versions.sh
source "${SCRIPT_DIR}/nav-versions.sh"
# shellcheck disable=SC1091
source "${NAV_VARS}"

MIN_FREE_MB="${NAV_MIN_FREE_MB:-1024}"

for unit in pmtiles nginx; do
  systemctl enable "${unit}" >/dev/null 2>&1 || true
  systemctl restart "${unit}"
done
haproxy -c -f /etc/haproxy/haproxy.cfg >/dev/null
systemctl reload haproxy

for port in "${PMTILES_PORT}" "${NAV_STATIC_PORT}" "${NAV_TLS_PORT}"; do
  ss -ltn | grep -q "127.0.0.1:${port} " || die "nothing listens on 127.0.0.1:${port}"
  if ss -ltn | awk '{print $4}' | grep -E "(^|:)${port}$" | grep -vq "127.0.0.1:${port}"; then
    die "port ${port} is bound on a non-loopback interface"
  fi
done
ok "loopback listeners: ${PMTILES_PORT} (pmtiles), ${NAV_STATIC_PORT} (nginx), ${NAV_TLS_PORT} (haproxy nav)"

for unit in communication pmtiles nginx coturn redis-server; do
  rss="$(systemctl show "${unit}" -p MemoryCurrent --value 2>/dev/null || echo 0)"
  printf '  %-14s %6d MB\n' "${unit}" "$(( rss / 1048576 ))"
done
available="$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)"
info "MemAvailable: ${available} MB"
(( available >= MIN_FREE_MB )) || die "Only ${available} MB left on the box"
ok "Navigation services up, ${available} MB available"
