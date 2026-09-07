#!/usr/bin/env bash
# nav-regions.sh — the regions the navigator offers for download. Adding a
# region is one entry per table; `install-navigation.sh` builds them all,
# `NAV_REGION=<id>` limits a run to one.
# shellcheck disable=SC2034

NAV_REGION_IDS=(dubai)

declare -A NAV_REGION_NAME_EN=(
  [dubai]="Dubai"
)
declare -A NAV_REGION_NAME_RU=(
  [dubai]="Дубай"
)
declare -A NAV_REGION_NAME_NATIVE=(
  [dubai]="دبي"
)
# Geofabrik extract the region is clipped from (daily builds, ODbL).
declare -A NAV_REGION_SOURCE=(
  [dubai]="https://download.geofabrik.de/asia/gcc-states-latest.osm.pbf"
)
# west,south,east,north in degrees — Jebel Ali to Al Warqa, the coast to the E311 belt.
declare -A NAV_REGION_BBOX=(
  [dubai]="54.85,24.75,55.65,25.40"
)
declare -A NAV_REGION_TIME_ZONE=(
  [dubai]="Asia/Dubai"
)

# The regions a run works on: all of them, or the one named in NAV_REGION.
nav_selected_regions() {
  if [[ -n "${NAV_REGION:-}" ]]; then
    [[ -n "${NAV_REGION_SOURCE[${NAV_REGION}]:-}" ]] || die "Unknown region: ${NAV_REGION}"
    echo "${NAV_REGION}"
  else
    printf '%s\n' "${NAV_REGION_IDS[@]}"
  fi
}
