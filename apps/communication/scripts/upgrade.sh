#!/usr/bin/env bash
# upgrade.sh — pull, rebuild, gracefully restart, smoke-test.
# Assumes install.sh has already been run on this host.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="${SCRIPT_DIR}/lib"
# shellcheck source=lib/common.sh
source "${LIB}/common.sh"
# shellcheck source=lib/parse-args.sh
source "${LIB}/parse-args.sh"
# shellcheck source=lib/remote-run.sh
source "${LIB}/remote-run.sh"

parse_upgrade_args "$@"
validate_upgrade_args

REMOTE_TS="$(date +%s)"
export REMOTE_TS

SSH_CONTROL_PATH="/tmp/comm-${REMOTE_TS}.sock"

trap stop_ssh_master EXIT INT TERM

info "Upgrading ${SSH_HOST}"
start_ssh_master
rsync_lib_to_target

remote_run_script pull-repo
remote_run_script install-deps
remote_run_script build-app
remote_run_script graceful-restart
remote_run_script smoke-test

ok "Upgrade complete"
