#!/usr/bin/env bash
# install.sh — provision a fresh Ubuntu host with HAProxy + coturn +
# the communication Node service. Driven from the operator's machine
# over SSH; all heavy lifting happens via lib/*.sh on the target.
#
# Example:
#   bash apps/communication/scripts/install.sh \
#     --ssh-host root@1.2.3.4 \
#     --google-client-id 1234567890.apps.googleusercontent.com \
#     --cert-email ops@example.com
#
# Optional: --no-haproxy --domain communication.example.com

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="${SCRIPT_DIR}/lib"
# shellcheck source=lib/common.sh
source "${LIB}/common.sh"
# shellcheck source=lib/parse-args.sh
source "${LIB}/parse-args.sh"
# shellcheck source=lib/remote-run.sh
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
rsync_lib_to_target
stage_operator_ssh_keys_to_target

# Harden SSH FIRST: install operator's pub keys, then disable password
# auth. Done before any package install / build so a failure later does
# not leave the host both broken AND password-authenticated.
remote_run_script install-ssh-keys
if [[ "${HARDEN_SSH:-true}" == "true" ]]; then
  remote_run_script disable-ssh-password-auth
else
  info "Skipping SSH password-auth disable (--no-harden-ssh)"
fi

remote_run_script ensure-system-packages
if [[ "${INSTALL_REDIS:-true}" == "true" ]]; then
  remote_run_script ensure-redis
else
  info "Skipping redis install (--no-redis)"
fi
remote_run_script ensure-system-user
remote_run_script ensure-repo-clone
remote_run_script build-app
remote_run_script generate-turn-secret
remote_run_script render-toml-configs
remote_run_script render-systemd-unit
remote_run_script render-renewal-hook
remote_run_script render-journald-conf
remote_run_script render-cert-expiry-timer
remote_run_script obtain-letsencrypt-cert
remote_run_script render-haproxy-cfg
remote_run_script render-coturn-cfg
remote_run_script configure-ufw
remote_run_script enable-systemd-services
remote_run_script smoke-test

ok "Installation complete"
