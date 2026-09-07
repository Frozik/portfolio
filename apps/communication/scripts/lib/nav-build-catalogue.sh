#!/usr/bin/env bash
# nav-build-catalogue.sh — regions.json, the one file the client fetches to
# learn the world layer version and every downloadable region.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=nav-versions.sh
source "${SCRIPT_DIR}/nav-versions.sh"

[[ -f "${NAV_DATA}/tiles/world.json" ]] || die "world.json missing — nav-build-world.sh has not run"

python3 - "${NAV_DATA}" "${NAV_PUBLIC}" "${NAV_REGION_IDS_JOINED:-}" <<'PYEOF'
import json, pathlib, sys
from datetime import datetime, timezone

data = pathlib.Path(sys.argv[1]); public = pathlib.Path(sys.argv[2])
world = json.loads((data / 'tiles' / 'world.json').read_text())
regions = []
for region_dir in sorted((public / 'packs').iterdir()):
    if not region_dir.is_dir():
        continue
    versions = sorted(p for p in region_dir.iterdir() if p.is_dir() and (p / 'region.json').exists())
    if not versions:
        continue
    manifest = json.loads((versions[-1] / 'region.json').read_text())
    base = f"/packs/{manifest['id']}/{manifest['version']}"
    regions.append({
        'id': manifest['id'],
        'names': manifest['names'],
        'bbox': manifest['bbox'],
        'timeZone': manifest['timeZone'],
        'version': manifest['version'],
        'packFormatVersion': manifest['packFormatVersion'],
        'dataDate': manifest['dataDate'],
        'tiles': {**manifest['tiles'], 'url': f'{base}/region.pmtiles'},
        'graph': {**manifest['graph'], 'url': f'{base}/region.graph'},
        'manifestUrl': f'{base}/region.json',
        'attribution': manifest['attribution'],
    })
catalogue = {
    'catalogueVersion': 1,
    'generatedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'world': {'version': world['version'], 'maxzoom': world['maxzoom'], 'bytes': world['bytes'], 'tilesUrl': '/tiles/world/{z}/{x}/{y}.mvt', 'attribution': world['attribution']},
    'regionTilesUrl': '/tiles/{id}/{z}/{x}/{y}.mvt',
    'regions': regions,
}
target = public / 'regions.json'
target.write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + '\n')
print(f"regions.json: {len(regions)} region(s)")
PYEOF
chown "${NAV_USER}:${NAV_USER}" "${NAV_PUBLIC}/regions.json"
chmod 644 "${NAV_PUBLIC}/regions.json"
ok "Catalogue written"
