#!/usr/bin/env bash
# nav-publish-region.sh — the downloadable pack of every selected region:
# a versioned directory under the public tree with the tiles archive (hard
# linked to the served one), the routing pack, its gzip twin for
# nginx's gzip_static, and the manifest the client trusts. Older versions
# are removed once a newer one is published.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=nav-versions.sh
source "${SCRIPT_DIR}/nav-versions.sh"
# shellcheck source=nav-regions.sh
source "${SCRIPT_DIR}/nav-regions.sh"

json_field() {
  python3 -c "import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]])" "$1" "$2"
}

for region in $(nav_selected_regions); do
  tiles="${NAV_DATA}/tiles/${region}.pmtiles"
  graph="${NAV_DATA}/graphs/${region}.graph"
  extract="${NAV_DATA}/osm/${region}.extract.json"
  stats="${NAV_DATA}/graphs/${region}.graph.json"
  for required in "${tiles}" "${graph}" "${extract}" "${stats}"; do
    [[ -f "${required}" ]] || die "${region}: missing ${required}"
  done
  data_date="$(json_field "${extract}" dataDate)"
  format_version="$(json_field "${stats}" packFormatVersion)"
  version="${data_date//-/}.p${format_version}"
  dir="${NAV_PUBLIC}/packs/${region}/${version}"
  if [[ -f "${dir}/region.json" && "${dir}/region.graph" -nt "${graph}" ]]; then
    ok "${region}: ${version} already published"
    continue
  fi
  info "${region}: publishing ${version}"
  rm -rf "${dir}.part" && mkdir -p "${dir}.part"
  ln -f "${tiles}" "${dir}.part/region.pmtiles" 2>/dev/null || cp "${tiles}" "${dir}.part/region.pmtiles"
  cp "${graph}" "${dir}.part/region.graph"
  gzip -9 -k -f "${dir}.part/region.graph"
  cat > "${dir}.part/region.json" <<JSON
{
  "id": "${region}",
  "version": "${version}",
  "packFormatVersion": ${format_version},
  "dataDate": "${data_date}",
  "bbox": $(json_field "${extract}" bbox | tr "'" '"'),
  "timeZone": "${NAV_REGION_TIME_ZONE[${region}]}",
  "names": {
    "en": "${NAV_REGION_NAME_EN[${region}]}",
    "ru": "${NAV_REGION_NAME_RU[${region}]}",
    "native": "${NAV_REGION_NAME_NATIVE[${region}]}"
  },
  "tiles": { "bytes": $(stat -c %s "${tiles}"), "sha256": "$(sha256sum "${tiles}" | cut -d' ' -f1)", "minzoom": ${REGION_MINZOOM}, "maxzoom": ${REGION_MAXZOOM} },
  "graph": { "bytes": $(stat -c %s "${graph}"), "sha256": "$(sha256sum "${graph}" | cut -d' ' -f1)" },
  "publishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "attribution": "© OpenStreetMap contributors, © OpenMapTiles"
}
JSON
  chmod 644 "${dir}.part"/*
  rm -rf "${dir}" && mv "${dir}.part" "${dir}"
  # Drop every other version of this region; the catalogue names only the newest.
  for old in "${NAV_PUBLIC}/packs/${region}"/*/; do
    [[ "${old%/}" == "${dir}" ]] || rm -rf "${old}"
  done
  chown -R "${NAV_USER}:${NAV_USER}" "${NAV_PUBLIC}/packs/${region}"
  ok "${region}: ${dir} ($(du -sh "${dir}" | cut -f1))"
done
