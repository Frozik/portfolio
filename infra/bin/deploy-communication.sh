#!/usr/bin/env bash
# upgrade.sh — pull the published image, restart the stack, smoke-test.
# Assumes install.sh has already been run on this host.
#
# Set COMMUNICATION_TAG to deploy (or roll back to) an exact image tag;
# without it the stack follows :latest.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LIB="${INFRA_DIR}/lib"
# shellcheck source=../lib/common.sh
source "${LIB}/common.sh"
# shellcheck source=../lib/parse-args.sh
source "${LIB}/parse-args.sh"
# shellcheck source=../lib/remote-run.sh
source "${LIB}/remote-run.sh"

parse_upgrade_args "$@"
validate_upgrade_args

REMOTE_TS="$(date +%s)"
export REMOTE_TS

SSH_CONTROL_PATH="/tmp/comm-${REMOTE_TS}.sock"

trap stop_ssh_master EXIT INT TERM

info "Upgrading ${SSH_HOST}"
start_ssh_master
rsync_infra_to_target

remote_run_script communication/compose-up
remote_run_script communication/smoke-test

ok "Upgrade complete"
