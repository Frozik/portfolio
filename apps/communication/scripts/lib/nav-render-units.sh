#!/usr/bin/env bash
# nav-render-units.sh — systemd units for the tile server and the router.
# Both bind loopback only; HAProxy's navigation frontend is the public face.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=nav-versions.sh
source "${SCRIPT_DIR}/nav-versions.sh"
# shellcheck disable=SC1091
source "${NAV_VARS}"

info "Writing /etc/systemd/system/pmtiles.service"
cat > /etc/systemd/system/pmtiles.service <<UNIT
[Unit]
Description=Navigation vector tiles (pmtiles serve, z/x/y API)
After=network.target

[Service]
Type=simple
User=${NAV_USER}
ExecStart=${NAV_ROOT}/bin/pmtiles serve ${NAV_DATA}/tiles --port=${PMTILES_PORT} --public-url=https://${NAV_DOMAIN}/tiles --cache-size=128
Restart=always
RestartSec=5s
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadOnlyPaths=${NAV_DATA}/tiles

[Install]
WantedBy=multi-user.target
UNIT

info "Writing /etc/systemd/system/graphhopper.service"
cat > /etc/systemd/system/graphhopper.service <<UNIT
[Unit]
Description=Navigation routing (GraphHopper: car, foot, bike)
After=network.target

[Service]
Type=simple
User=${NAV_USER}
WorkingDirectory=${NAV_DATA}/graphhopper
ExecStart=${NAV_ROOT}/jre/bin/java -Xms256m -Xmx1200m -XX:+UseSerialGC -jar ${NAV_ROOT}/lib/graphhopper-web-${GRAPHHOPPER_VERSION}.jar server config.yml
Restart=always
RestartSec=10s
# The JVM is told 1.2 GB; the cgroup cap is the hard stop before the OOM
# killer reaches the signaling service.
MemoryMax=1800M
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${NAV_DATA}/graphhopper

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
ok "Units rendered"
