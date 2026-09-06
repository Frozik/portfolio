#!/usr/bin/env bash
# nav-build-tiles.sh — planetiler-openmaptiles over the extract → one
# PMTiles archive. Water polygons and Natural Earth are downloaded once into
# planetiler-data (coastlines make the Gulf of Finland water). Heap is
# capped so the build never starves the signaling service on the 4 GB box.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=nav-versions.sh
source "${SCRIPT_DIR}/nav-versions.sh"

PBF="${NAV_DATA}/osm/${EXTRACT_NAME}.osm.pbf"
OUT="${NAV_DATA}/tiles/${EXTRACT_NAME}.pmtiles"
# planetiler picks the archive format from the extension, so the in-progress
# file must still end in .pmtiles.
BUILDING="${NAV_DATA}/tiles/${EXTRACT_NAME}-building.pmtiles"
JAR="${NAV_ROOT}/lib/planetiler-openmaptiles-${PLANETILER_VERSION}.jar"
HEAP="${NAV_BUILD_HEAP:-1600m}"

if [[ "${NAV_SKIP_BUILD:-false}" == "true" && -f "${OUT}" ]]; then
  ok "Tiles present, build skipped: ${OUT}"
  exit 0
fi
[[ -f "${PBF}" ]] || die "Extract missing: ${PBF}"

info "Building tiles from ${PBF} (heap ${HEAP})"
# planetiler keeps its downloads and scratch under ./data, hence the cwd.
sudo -u "${NAV_USER}" nice -n 10 bash -c "cd '${NAV_DATA}/planetiler-data' && '${NAV_ROOT}/jre/bin/java' -Xmx${HEAP} -jar '${JAR}' \
  --osm-path='${PBF}' \
  --download \
  --output='${BUILDING}' \
  --force \
  --languages=ru,en \
  --nodemap-type=sortedtable \
  --storage=mmap"
mv -f "${BUILDING}" "${OUT}"
chown "${NAV_USER}:${NAV_USER}" "${OUT}"
ok "Tiles: ${OUT} ($(du -h "${OUT}" | cut -f1))"
"${NAV_ROOT}/bin/pmtiles" show "${OUT}" | head -20
