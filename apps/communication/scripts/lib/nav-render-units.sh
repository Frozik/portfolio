#!/usr/bin/env bash
# nav-render-units.sh — the tile server unit and the nginx site for the
# pack files. Both bind loopback only; HAProxy's navigation frontend is
# the public face.
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
Description=Navigation vector tiles (pmtiles serve, /<archive>/z/x/y.mvt)
After=network.target

[Service]
Type=simple
User=${NAV_USER}
ExecStart=${NAV_ROOT}/bin/pmtiles serve ${NAV_DATA}/tiles --interface=127.0.0.1 --port=${PMTILES_PORT} --public-url=https://${NAV_DOMAIN}/tiles --cache-size=128
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

info "Writing /etc/nginx/sites-available/navigation-static"
cat > /etc/nginx/sites-available/navigation-static <<NGINX
# Pack files and the region catalogue for the navigator, behind HAProxy's
# navigation frontend. Range requests and gzip_static come for free; the
# version sits in every pack path, so packs are immutable and the catalogue
# is not.
server {
  listen 127.0.0.1:${NAV_STATIC_PORT};
  server_name _;
  root ${NAV_PUBLIC};
  access_log off;
  gzip_static on;
  types {
    application/json json;
    application/octet-stream pmtiles graph;
  }
  default_type application/octet-stream;

  location = /regions.json {
    add_header Cache-Control "no-cache";
  }
  location /packs/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
  location / {
    return 404;
  }
}
NGINX
ln -sf /etc/nginx/sites-available/navigation-static /etc/nginx/sites-enabled/navigation-static
nginx -t >/dev/null

systemctl daemon-reload
ok "Units rendered"
