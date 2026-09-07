#!/usr/bin/env bash
# nav-build-graph.sh — the routing pack of every selected region, built by
# apps/navigation-tools from the deploy checkout (the same TypeScript the
# browser decodes with). Skipped while the pack is newer than the clip
# unless NAV_SKIP_BUILD is off.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=nav-versions.sh
source "${SCRIPT_DIR}/nav-versions.sh"
# shellcheck source=nav-regions.sh
source "${SCRIPT_DIR}/nav-regions.sh"

TOOL_DIR="${NAV_REPO}/apps/navigation-tools"
HEAP_MB="${NAV_GRAPH_HEAP_MB:-1600}"
BENCH_ROUTES="${NAV_BENCH_ROUTES:-100}"

pack_cli() {
  # The checkout belongs to the deploy user; the tool only reads it and
  # writes to a scratch file the navigation user owns afterwards.
  sudo -u "${NAV_USER}" -H nice -n 10 env HOME="${NAV_DATA}" \
    node --max-old-space-size="${HEAP_MB}" "${TOOL_DIR}/node_modules/.bin/tsx" "${TOOL_DIR}/src/cli.ts" "$@"
}

for region in $(nav_selected_regions); do
  clip="${NAV_DATA}/osm/${region}.osm.pbf"
  out="${NAV_DATA}/graphs/${region}.graph"
  stats="${NAV_DATA}/graphs/${region}.graph.json"
  [[ -f "${clip}" ]] || die "${region}: clip missing: ${clip}"
  if [[ -f "${out}" && "${out}" -nt "${clip}" && "${NAV_SKIP_BUILD:-false}" == "true" ]]; then
    ok "${region}: graph present, build skipped"
    continue
  fi
  info "${region}: building routing pack"
  pack_cli build --pbf "${clip}" --out "${out}.part" > "${stats}.part"
  mv -f "${out}.part" "${out}"
  mv -f "${stats}.part" "${stats}"
  chown "${NAV_USER}:${NAV_USER}" "${out}" "${stats}"
  ok "${region}: pack $(du -h "${out}" | cut -f1)"
  info "${region}: ${BENCH_ROUTES} random routes"
  pack_cli bench --pack "${out}" --count "${BENCH_ROUTES}" | tee "${NAV_DATA}/graphs/${region}.bench.json"
  info "${region}: building-height coverage (plan Q12)"
  pack_cli stats --pbf "${clip}" | tee "${NAV_DATA}/graphs/${region}.buildings.json"
done
