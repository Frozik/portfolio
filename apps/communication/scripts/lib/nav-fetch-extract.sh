#!/usr/bin/env bash
# nav-fetch-extract.sh — the Geofabrik source of every selected region,
# clipped to the region's bounds with osmium. The source download is cached
# by URL and only re-fetched when Geofabrik has a newer file or
# NAV_REFRESH_EXTRACT=true; a region whose clip exists is skipped unless the
# source changed.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=nav-versions.sh
source "${SCRIPT_DIR}/nav-versions.sh"
# shellcheck source=nav-regions.sh
source "${SCRIPT_DIR}/nav-regions.sh"

SOURCES="${NAV_DATA}/osm/sources"

fetch_source() {
  local url="$1" file="$2"
  if [[ -f "${file}" && "${NAV_REFRESH_EXTRACT:-false}" != "true" ]]; then
    ok "Source cached: ${file} ($(du -h "${file}" | cut -f1)); pass --refresh-extract to check for a newer one"
    return 0
  fi
  info "Downloading ${url}"
  # -z: only when newer than the cached copy; curl leaves the file alone otherwise.
  if [[ -f "${file}" ]]; then
    curl -fsSL -z "${file}" -o "${file}.part" "${url}"
    if [[ -f "${file}.part" ]]; then
      mv "${file}.part" "${file}"
    else
      ok "Geofabrik has no newer file"
    fi
  else
    curl -fsSL -o "${file}.part" "${url}"
    mv "${file}.part" "${file}"
  fi
  curl -fsSI "${url}" | awk -F': ' 'tolower($1)=="last-modified"{print $2}' | tr -d '\r' > "${file}.last-modified"
  chown "${NAV_USER}:${NAV_USER}" "${file}" "${file}.last-modified"
}

for region in $(nav_selected_regions); do
  url="${NAV_REGION_SOURCE[${region}]}"
  source_file="${SOURCES}/$(basename "${url}")"
  clip="${NAV_DATA}/osm/${region}.osm.pbf"
  meta="${NAV_DATA}/osm/${region}.extract.json"
  fetch_source "${url}" "${source_file}"

  if [[ -f "${clip}" && "${clip}" -nt "${source_file}" && "${NAV_REFRESH_EXTRACT:-false}" != "true" ]]; then
    ok "${region}: clip up to date ($(du -h "${clip}" | cut -f1))"
    continue
  fi
  bbox="${NAV_REGION_BBOX[${region}]}"
  info "${region}: osmium extract --bbox ${bbox}"
  sudo -u "${NAV_USER}" nice -n 10 osmium extract --overwrite --strategy=complete_ways --bbox="${bbox}" -o "${clip}" "${source_file}"
  last_modified="$(cat "${source_file}.last-modified" 2>/dev/null || true)"
  data_date="$(date -u -d "${last_modified:-now}" +%Y-%m-%d)"
  cat > "${meta}" <<JSON
{
  "region": "${region}",
  "source": "${url}",
  "sourceLastModified": "${last_modified}",
  "dataDate": "${data_date}",
  "bbox": [${bbox}],
  "clippedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "bytes": $(stat -c %s "${clip}"),
  "sha256": "$(sha256sum "${clip}" | cut -d' ' -f1)"
}
JSON
  chown "${NAV_USER}:${NAV_USER}" "${meta}"
  ok "${region}: clip $(du -h "${clip}" | cut -f1), data date ${data_date}"
done
