#!/usr/bin/env bash
# nav-retire-graphhopper.sh — routes are computed on the device now; the
# server-side router, its jar and its graph go. Safe to re-run.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=nav-versions.sh
source "${SCRIPT_DIR}/nav-versions.sh"

if systemctl list-unit-files graphhopper.service >/dev/null 2>&1 && [[ -f /etc/systemd/system/graphhopper.service ]]; then
  info "Stopping and removing graphhopper.service"
  systemctl disable --now graphhopper >/dev/null 2>&1 || true
  rm -f /etc/systemd/system/graphhopper.service
  systemctl daemon-reload
fi
rm -f "${NAV_ROOT}"/lib/graphhopper-web-*.jar
rm -rf "${NAV_DATA}/graphhopper"
if grep -q GRAPHHOPPER_PORT "${NAV_VARS}" 2>/dev/null; then
  sed -i '/GRAPHHOPPER_PORT/d; /EXTRACT_NAME/d' "${NAV_VARS}"
fi
ok "GraphHopper retired"
