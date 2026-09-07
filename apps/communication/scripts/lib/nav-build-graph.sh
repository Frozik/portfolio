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
DEPLOY_USER="communication"
HEAP_MB="${NAV_GRAPH_HEAP_MB:-1600}"
BENCH_ROUTES="${NAV_BENCH_ROUTES:-100}"
# The checkout is readable by its deploy user only, so the tool runs as that
# user and writes into a scratch directory; root moves the results into the
# navigation tree afterwards.
SCRATCH="$(mktemp -d /tmp/nav-graph.XXXXXX)"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "${SCRATCH}"
trap 'rm -rf "${SCRATCH}"' EXIT

pack_cli() {
  sudo -u "${DEPLOY_USER}" -H nice -n 10 \
    node --max-old-space-size="${HEAP_MB}" "${TOOL_DIR}/node_modules/tsx/dist/cli.mjs" "${TOOL_DIR}/src/cli.ts" "$@"
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
  pack_cli build --pbf "${clip}" --out "${SCRATCH}/${region}.graph" > "${SCRATCH}/${region}.graph.json"
  info "${region}: ${BENCH_ROUTES} random routes"
  pack_cli bench --pack "${SCRATCH}/${region}.graph" --count "${BENCH_ROUTES}" | tee "${SCRATCH}/${region}.bench.json"
  info "${region}: building-height coverage (plan Q12)"
  pack_cli stats --pbf "${clip}" | tee "${SCRATCH}/${region}.buildings.json"
  for name in graph graph.json bench.json buildings.json; do
    mv -f "${SCRATCH}/${region}.${name}" "${NAV_DATA}/graphs/${region}.${name}"
    chown "${NAV_USER}:${NAV_USER}" "${NAV_DATA}/graphs/${region}.${name}"
  done
  ok "${region}: pack $(du -h "${out}" | cut -f1) — $(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d['nodes'], 'nodes,', d['edges'], 'edges,', d['seconds'], 's')" "${stats}")"
done
