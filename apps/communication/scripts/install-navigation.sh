#!/usr/bin/env bash
# install-navigation.sh — the navigator's data and services on the signaling
# host: runtime, the world layer, every region's extract, tiles and routing
# pack, the published pack directories and catalogue, the units, the
# certificate SAN and the HAProxy frontend. Re-runnable; the heavy builds
# are skipped with --skip-build.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="${SCRIPT_DIR}/lib"
# shellcheck source=lib/common.sh
source "${LIB}/common.sh"
# shellcheck source=lib/remote-run.sh
source "${LIB}/remote-run.sh"

SSH_HOST=""
CERT_EMAIL="${CERT_EMAIL:-}"
NAV_SKIP_BUILD=false
NAV_REFRESH_EXTRACT=false
NAV_REFRESH_WORLD=false
NAV_REGION=""

usage() {
  cat <<USAGE
Usage: install-navigation.sh --ssh-host root@IP [--cert-email you@example.com]
                             [--skip-build] [--refresh-extract] [--refresh-world] [--region <id>]

  --ssh-host         SSH target of the signaling host (install.sh must have run)
  --cert-email       Let's Encrypt contact, needed the first time the nav hostname is added
  --skip-build       keep existing tiles and routing packs that are newer than their extract
  --refresh-extract  re-download the Geofabrik source and re-clip the regions
  --refresh-world    rebuild the world layer
  --region <id>      work on one region only (see lib/nav-regions.sh)
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ssh-host) SSH_HOST="$2"; shift 2;;
    --cert-email) CERT_EMAIL="$2"; shift 2;;
    --skip-build) NAV_SKIP_BUILD=true; shift;;
    --refresh-extract) NAV_REFRESH_EXTRACT=true; shift;;
    --refresh-world) NAV_REFRESH_WORLD=true; shift;;
    --region) NAV_REGION="$2"; shift 2;;
    -h|--help) usage; exit 0;;
    *) err "Unknown argument: $1"; usage; exit 2;;
  esac
done
[[ -n "${SSH_HOST}" ]] || { err "Missing --ssh-host"; usage; exit 2; }
export SSH_HOST CERT_EMAIL NAV_SKIP_BUILD NAV_REFRESH_EXTRACT NAV_REFRESH_WORLD NAV_REGION

REMOTE_TS="$(date +%s)"
export REMOTE_TS
SSH_CONTROL_PATH="/tmp/comm-${REMOTE_TS}.sock"
trap stop_ssh_master EXIT INT TERM

info "Installing navigation stack on ${SSH_HOST}"
start_ssh_master
rsync_lib_to_target

remote_run_script nav-install-runtime
remote_run_script nav-retire-graphhopper
remote_run_script nav-fetch-extract
remote_run_script nav-build-tiles
remote_run_script nav-build-world
remote_run_script nav-build-graph
remote_run_script nav-publish-region
remote_run_script nav-build-catalogue
remote_run_script nav-render-units
remote_run_script nav-expand-cert
remote_run_script render-renewal-hook
remote_run_script render-haproxy-cfg
remote_run_script nav-enable-services
remote_run_script nav-smoke-test

ok "Navigation stack ready"
