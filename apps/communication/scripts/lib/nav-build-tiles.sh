#!/usr/bin/env bash
# nav-build-tiles.sh — planetiler-openmaptiles over every selected region's
# clip → one PMTiles archive per region for the zooms the world layer does
# not cover. Water polygons and Natural Earth are downloaded once into
# planetiler-data. Heap is capped so the build never starves the signaling
# service on the 4 GB box.
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

for region in $(nav_selected_regions); do
  clip="${NAV_DATA}/osm/${region}.osm.pbf"
  out="${NAV_DATA}/tiles/${region}.pmtiles"
  # planetiler picks the archive format from the extension, so the
  # in-progress file must still end in .pmtiles.
  building="${NAV_DATA}/tiles/${region}-building.pmtiles"
  [[ -f "${clip}" ]] || die "${region}: clip missing: ${clip}"
  if [[ -f "${out}" && "${out}" -nt "${clip}" && "${NAV_SKIP_BUILD:-false}" == "true" ]]; then
    ok "${region}: tiles present, build skipped"
    continue
  fi
  info "${region}: building tiles z${REGION_MINZOOM}–${REGION_MAXZOOM} (heap ${HEAP})"
  # planetiler keeps its downloads and scratch under ./data, hence the cwd.
  sudo -u "${NAV_USER}" nice -n 10 bash -c "cd '${NAV_DATA}/planetiler-data' && '${NAV_ROOT}/jre/bin/java' -Xmx${HEAP} -jar '${JAR}' \
    --osm-path='${clip}' \
    --download \
    --output='${building}' \
    --force \
    --minzoom=${REGION_MINZOOM} \
    --maxzoom=${REGION_MAXZOOM} \
    --languages=en,ru \
    --nodemap-type=sortedtable \
    --storage=mmap"
  mv -f "${building}" "${out}"
  chown "${NAV_USER}:${NAV_USER}" "${out}"
  ok "${region}: tiles ${out} ($(du -h "${out}" | cut -f1))"
done
