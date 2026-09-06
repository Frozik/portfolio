#!/usr/bin/env bash
# nav-smoke-test.sh — a tile over the city centre and a foot route across
# it, through HAProxy with a portfolio origin, exactly as the browser asks.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=nav-versions.sh
source "${SCRIPT_DIR}/nav-versions.sh"
# shellcheck disable=SC1091
source "${NAV_VARS}"

BASE="https://${NAV_DOMAIN}"
ORIGIN="https://frozik.github.io"
# Zoom 13 tile holding Palace Square (59.939 N, 30.316 E).
TILE_URL="${BASE}/tiles/${EXTRACT_NAME}/13/4785/2381.mvt"
ROUTE_URL="${BASE}/route?point=59.9391,30.3158&point=59.9311,30.3609&profile=foot&locale=ru&points_encoded=false"

for unit in pmtiles graphhopper haproxy; do
  systemctl is-active --quiet "${unit}" && ok "${unit} active" || die "${unit} not active"
done

info "GET ${TILE_URL}"
headers="$(curl -fsS --max-time 10 -o /tmp/nav-tile.mvt -D - -H "Origin: ${ORIGIN}" "${TILE_URL}")"
grep -qi "access-control-allow-origin: ${ORIGIN}" <<<"${headers}" || die "CORS header missing on tiles"
ok "tile $(stat -c %s /tmp/nav-tile.mvt) bytes, CORS ok"

info "GET ${ROUTE_URL}"
body="$(curl -fsS --max-time 20 -H "Origin: ${ORIGIN}" "${ROUTE_URL}")"
distance="$(python3 -c "import json,sys; p=json.loads(sys.argv[1])['paths'][0]; print(int(p['distance']), p['instructions'][0]['text'])" "${body}")"
ok "foot route: ${distance}"

info "OPTIONS preflight"
code="$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS -H "Origin: ${ORIGIN}" -H 'Access-Control-Request-Method: GET' "${ROUTE_URL}")"
[[ "${code}" == "204" ]] || die "preflight returned ${code}"
ok "preflight 204"
