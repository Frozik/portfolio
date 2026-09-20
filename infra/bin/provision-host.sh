#!/usr/bin/env bash
# install.sh — provision a fresh Ubuntu host with HAProxy + coturn +
# the communication service. Driven from the operator's machine over SSH;
# all heavy lifting happens via lib/*.sh on the target.
#
# The app itself runs as a container pulled from the registry (redis
# alongside it); nothing is built on the box.
#
# Example:
#   bash infra/bin/provision-host.sh \
#     --ssh-host root@1.2.3.4 \
#     --google-client-id 1234567890.apps.googleusercontent.com \
#     --cert-email ops@example.com
#
# Optional: --no-haproxy --domain communication.example.com

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

parse_install_args "$@"
validate_install_args

REMOTE_TS="$(date +%s)"
export REMOTE_TS

# Re-derive after exporting REMOTE_TS so the control socket path uses it.
# Keep the path short — Unix domain sockets are capped at ~104 bytes on
# macOS, and OpenSSH appends a random suffix at master-listener time.
SSH_CONTROL_PATH="/tmp/comm-${REMOTE_TS}.sock"

# Tear down the SSH master on any exit so the control socket does not
# leak into ~/.ssh/.
trap stop_ssh_master EXIT INT TERM

info "Provisioning ${SSH_HOST}"
start_ssh_master
rsync_infra_to_target
stage_operator_ssh_keys_to_target

# Harden SSH FIRST: install operator's pub keys, then disable password
# auth. Done before any package install / build so a failure later does
# not leave the host both broken AND password-authenticated.
remote_run_script edge/ssh-keys
if [[ "${HARDEN_SSH:-true}" == "true" ]]; then
  remote_run_script edge/ssh-hardening
else
  info "Skipping SSH password-auth disable (--no-harden-ssh)"
fi

remote_run_script edge/packages
remote_run_script edge/trim-packages
remote_run_script communication/docker
remote_run_script communication/turn-secret
remote_run_script communication/oauth-secrets
remote_run_script communication/config
remote_run_script edge/renewal-hook
remote_run_script edge/journald
remote_run_script edge/log-hygiene
remote_run_script edge/expiry-timer
remote_run_script edge/certificate
remote_run_script edge/haproxy
remote_run_script edge/coturn
remote_run_script edge/firewall
remote_run_script edge/enable-services
remote_run_script communication/compose-up
remote_run_script communication/deploy-user
remote_run_script communication/docker-prune
remote_run_script communication/smoke-test

ok "Installation complete"
