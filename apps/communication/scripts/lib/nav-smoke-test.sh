#!/usr/bin/env bash
# nav-smoke-test.sh — what the browser will do, through HAProxy with a
# portfolio origin: read the catalogue, fetch a world tile and a region tile,
# probe the pack files for resumable downloads, and a CORS preflight.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=nav-versions.sh
source "${SCRIPT_DIR}/nav-versions.sh"
# shellcheck source=nav-regions.sh
source "${SCRIPT_DIR}/nav-regions.sh"
# shellcheck disable=SC1091
source "${NAV_VARS}"

BASE="https://${NAV_DOMAIN}"
ORIGIN="https://frozik.github.io"
REGION="${NAV_REGION_IDS[0]}"

for unit in pmtiles nginx haproxy; do
  systemctl is-active --quiet "${unit}" && ok "${unit} active" || die "${unit} not active"
done

info "GET ${BASE}/regions.json"
catalogue="$(curl -fsS --max-time 10 -H "Origin: ${ORIGIN}" "${BASE}/regions.json")"
read -r graph_url graph_bytes tiles_url bbox <<<"$(python3 -c "
import json,sys
c=json.loads(sys.argv[1]); r=next(x for x in c['regions'] if x['id']==sys.argv[2])
print(r['graph']['url'], r['graph']['bytes'], r['tiles']['url'], ','.join(str(v) for v in r['bbox']))" "${catalogue}" "${REGION}")"
ok "catalogue lists ${REGION}; world v$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['world']['version'])" "${catalogue}")"

# Tile addresses from the region's bbox centre: z2 for the world, z13 for the region.
read -r world_tile region_tile <<<"$(python3 -c "
import math,sys
w,s,e,n=(float(v) for v in sys.argv[1].split(','))
lon=(w+e)/2; lat=(s+n)/2
def tile(z):
    x=int((lon+180)/360*2**z); y=int((1-math.log(math.tan(math.radians(lat))+1/math.cos(math.radians(lat)))/math.pi)/2*2**z)
    return f'{z}/{x}/{y}'
print(tile(2), tile(13))" "${bbox}")"

for url in "${BASE}/tiles/world/${world_tile}.mvt" "${BASE}/tiles/${REGION}/${region_tile}.mvt"; do
  info "GET ${url}"
  headers="$(curl -fsS --max-time 10 -o /tmp/nav-tile.mvt -D - -H "Origin: ${ORIGIN}" "${url}")"
  grep -qi "access-control-allow-origin: ${ORIGIN}" <<<"${headers}" || die "CORS header missing on ${url}"
  ok "tile $(stat -c %s /tmp/nav-tile.mvt) bytes, CORS ok"
done

info "HEAD ${BASE}${graph_url}"
headers="$(curl -fsSI --max-time 10 -H "Origin: ${ORIGIN}" "${BASE}${graph_url}")"
grep -qi "accept-ranges: bytes" <<<"${headers}" || die "pack is not range-served"
grep -qi "content-length: ${graph_bytes}" <<<"${headers}" || die "pack size differs from the manifest"
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H 'Range: bytes=0-1023' "${BASE}${graph_url}")"
[[ "${code}" == "206" ]] || die "ranged GET returned ${code}"
ok "pack ${graph_bytes} bytes, ranges ok"
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -I "${BASE}${tiles_url}")"
[[ "${code}" == "200" ]] || die "tiles archive HEAD returned ${code}"
ok "tiles archive reachable"

info "OPTIONS preflight"
code="$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS -H "Origin: ${ORIGIN}" -H 'Access-Control-Request-Method: GET' "${BASE}${graph_url}")"
[[ "${code}" == "204" ]] || die "preflight returned ${code}"
ok "preflight 204"
