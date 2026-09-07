#!/usr/bin/env bash
# nav-build-world.sh — the always-present world layer (z0–WORLD_MAXZOOM).
# planetiler-openmaptiles draws these zooms from Natural Earth and the OSM
# water polygons it downloads itself, so a tiny OSM input is enough to get
# coastlines, countries and major places for the whole planet in the same
# schema the regions use. Rebuilt only with NAV_REFRESH_WORLD=true.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=nav-versions.sh
source "${SCRIPT_DIR}/nav-versions.sh"
# shellcheck source=nav-regions.sh
source "${SCRIPT_DIR}/nav-regions.sh"

JAR="${NAV_ROOT}/lib/planetiler-openmaptiles-${PLANETILER_VERSION}.jar"
HEAP="${NAV_BUILD_HEAP:-1600m}"
OUT="${NAV_DATA}/tiles/world.pmtiles"
BUILDING="${NAV_DATA}/tiles/world-building.pmtiles"
META="${NAV_DATA}/tiles/world.json"

if [[ -f "${OUT}" && "${NAV_REFRESH_WORLD:-false}" != "true" ]]; then
  ok "World layer present ($(du -h "${OUT}" | cut -f1)); pass --refresh-world to rebuild"
  exit 0
fi

# Any region clip works as the OSM input; its own features are cut away by the zoom cap.
seed="${NAV_DATA}/osm/${NAV_REGION_IDS[0]}.osm.pbf"
[[ -f "${seed}" ]] || die "No region clip to seed the world build: ${seed}"

info "Building world layer z0–${WORLD_MAXZOOM} (heap ${HEAP})"
sudo -u "${NAV_USER}" nice -n 10 bash -c "cd '${NAV_DATA}/planetiler-data' && '${NAV_ROOT}/jre/bin/java' -Xmx${HEAP} -jar '${JAR}' \
  --osm-path='${seed}' \
  --download \
  --bounds=planet \
  --output='${BUILDING}' \
  --force \
  --maxzoom=${WORLD_MAXZOOM} \
  --languages=en,ru \
  --nodemap-type=sortedtable \
  --storage=mmap"
mv -f "${BUILDING}" "${OUT}"
chown "${NAV_USER}:${NAV_USER}" "${OUT}"
cat > "${META}" <<JSON
{
  "version": "$(date -u +%Y%m%d)",
  "maxzoom": ${WORLD_MAXZOOM},
  "builtAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "bytes": $(stat -c %s "${OUT}"),
  "attribution": "© OpenStreetMap contributors, © OpenMapTiles, Natural Earth"
}
JSON
chown "${NAV_USER}:${NAV_USER}" "${META}"
ok "World layer ${OUT} ($(du -h "${OUT}" | cut -f1))"
"${NAV_ROOT}/bin/pmtiles" show "${OUT}" | head -12
