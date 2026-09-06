#!/usr/bin/env bash
# install-navigation.sh — the OSM navigator's data and services on the
# signaling host: runtime, city extract, tiles, routing graph, units, the
# certificate SAN and the HAProxy frontend. Re-runnable; the heavy builds
# are skipped with --skip-build and the extract refreshed with
# --refresh-extract.
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

usage() {
  cat <<USAGE
Usage: install-navigation.sh --ssh-host root@IP [--cert-email you@example.com] [--skip-build] [--refresh-extract]

  --ssh-host         SSH target of the signaling host (install.sh must have run)
  --cert-email       Let's Encrypt contact, needed the first time the nav hostname is added
  --skip-build       keep the existing tiles and routing graph
  --refresh-extract  download a fresh city extract before building
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ssh-host) SSH_HOST="$2"; shift 2;;
    --cert-email) CERT_EMAIL="$2"; shift 2;;
    --skip-build) NAV_SKIP_BUILD=true; shift;;
    --refresh-extract) NAV_REFRESH_EXTRACT=true; shift;;
    -h|--help) usage; exit 0;;
    *) err "Unknown argument: $1"; usage; exit 2;;
  esac
done
[[ -n "${SSH_HOST}" ]] || { err "Missing --ssh-host"; usage; exit 2; }
export SSH_HOST CERT_EMAIL NAV_SKIP_BUILD NAV_REFRESH_EXTRACT

REMOTE_TS="$(date +%s)"
export REMOTE_TS
SSH_CONTROL_PATH="/tmp/comm-${REMOTE_TS}.sock"
trap stop_ssh_master EXIT INT TERM

info "Installing navigation stack on ${SSH_HOST}"
start_ssh_master
rsync_lib_to_target

remote_run_script nav-install-runtime
remote_run_script nav-fetch-extract
remote_run_script nav-build-tiles
remote_run_script nav-build-routing
remote_run_script nav-render-units
remote_run_script nav-expand-cert
remote_run_script render-renewal-hook
remote_run_script render-haproxy-cfg
remote_run_script nav-enable-services
remote_run_script nav-smoke-test

ok "Navigation stack ready"
