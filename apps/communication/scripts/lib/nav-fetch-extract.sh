#!/usr/bin/env bash
# nav-fetch-extract.sh — the city's OSM extract and the manifest the client
# shows as the data date. Re-downloaded only with NAV_REFRESH_EXTRACT=true.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=nav-versions.sh
source "${SCRIPT_DIR}/nav-versions.sh"

PBF="${NAV_DATA}/osm/${EXTRACT_NAME}.osm.pbf"
MANIFEST="${NAV_DATA}/tiles/manifest.json"

if [[ -f "${PBF}" && "${NAV_REFRESH_EXTRACT:-false}" != "true" ]]; then
  ok "Extract present: ${PBF} ($(du -h "${PBF}" | cut -f1)); pass --refresh-extract to re-download"
  exit 0
fi

info "Downloading ${EXTRACT_URL}"
curl -fsSL -o "${PBF}.part" "${EXTRACT_URL}"
mv "${PBF}.part" "${PBF}"
chown "${NAV_USER}:${NAV_USER}" "${PBF}"

last_modified="$(curl -fsSI "${EXTRACT_URL}" | awk -F': ' 'tolower($1)=="last-modified"{print $2}' | tr -d '\r')"
cat > "${MANIFEST}" <<JSON
{
  "extract": "${EXTRACT_NAME}",
  "source": "${EXTRACT_URL}",
  "sourceLastModified": "${last_modified}",
  "fetchedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "bytes": $(stat -c %s "${PBF}"),
  "sha256": "$(sha256sum "${PBF}" | cut -d' ' -f1)"
}
JSON
chown "${NAV_USER}:${NAV_USER}" "${MANIFEST}"
ok "Extract $(du -h "${PBF}" | cut -f1), manifest written"
