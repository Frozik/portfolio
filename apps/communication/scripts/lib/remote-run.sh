#!/usr/bin/env bash
# remote-run.sh — rsync lib/ to target then invoke sub-scripts over SSH.
#
# Uses SSH ControlMaster multiplexing so the operator is prompted for
# their password (or key passphrase) ONCE, not per sub-script.
#
# Exports: start_ssh_master, stop_ssh_master, rsync_lib_to_target,
# stage_operator_ssh_keys_to_target, remote_run_script.

set -euo pipefail

REMOTE_TS="${REMOTE_TS:-$(date +%s)}"
REMOTE_DIR="/tmp/communication-install-${REMOTE_TS}"
LIB_DIR="${LIB:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
SSH_CONTROL_PATH="/tmp/comm-${REMOTE_TS}.sock"

# ssh_opts — common ControlMaster options shared by every ssh/rsync.
ssh_opts() {
  printf -- '-o ControlPath=%s -o ControlMaster=auto -o ControlPersist=30m -o ServerAliveInterval=30' "${SSH_CONTROL_PATH}"
}

# Filter the two cosmetic ssh stderr lines that some sshd configs emit
# when MaxSessions limits the master to one channel — multiplexing
# silently falls back to direct ssh (which authenticates via the keys
# install-ssh-keys.sh installed) so the messages are noise.
_filter_ssh_noise() {
  grep -v -F -e 'Master refused session request: Permission denied' \
            -e 'already exists, disabling multiplexing' >&2 || true
}

# ssh_via_master — one-shot ssh that piggybacks on the open master.
ssh_via_master() {
  # shellcheck disable=SC2046
  ssh $(ssh_opts) "$@" 2> >(_filter_ssh_noise)
}

# rsync_via_master — rsync over the multiplexed ssh control connection.
rsync_via_master() {
  rsync --archive -e "ssh $(ssh_opts)" "$@" 2> >(_filter_ssh_noise)
}

# start_ssh_master — open a persistent ssh control socket. Operator is
# prompted for password / key passphrase ONCE here; every subsequent
# ssh/rsync reuses the same TCP+TLS+auth context.
start_ssh_master() {
  require_env SSH_HOST
  # Already up? (idempotent for partial re-runs.)
  if ssh -o ControlPath="${SSH_CONTROL_PATH}" -O check "${SSH_HOST}" > /dev/null 2>&1; then
    info "SSH master to ${SSH_HOST} already up"
    return 0
  fi
  info "Opening SSH master connection to ${SSH_HOST} (you may be prompted for a password ONCE)"
  # -M master, -N no command, -f background.
  ssh -o ControlPath="${SSH_CONTROL_PATH}" -o ControlMaster=yes -o ControlPersist=30m -MNf "${SSH_HOST}"
  ok "SSH master connection established (multiplexed; no further password prompts)"
}

# stop_ssh_master — close the control socket. Called from a trap.
stop_ssh_master() {
  if [[ -z "${SSH_HOST:-}" ]]; then
    return 0
  fi
  if ssh -o ControlPath="${SSH_CONTROL_PATH}" -O check "${SSH_HOST}" > /dev/null 2>&1; then
    ssh -o ControlPath="${SSH_CONTROL_PATH}" -O exit "${SSH_HOST}" > /dev/null 2>&1 || true
  fi
  rm -f "${SSH_CONTROL_PATH}"
}

# env_for_remote — emit the subset of environment that sub-scripts need
# as a single space-separated `KEY=VALUE` string suitable for `env`.
env_for_remote() {
  local pairs=()
  local keys=(
    SSH_HOST
    GOOGLE_OAUTH_CLIENT_ID
    YANDEX_OAUTH_CLIENT_ID
    YANDEX_OAUTH_CLIENT_SECRET
    CERT_EMAIL
    EDGE_HAPROXY_ENABLED
    COMMUNICATION_DOMAIN
    COMMUNICATION_CORS_ORIGINS
    COMMUNICATION_IP
    TURN_SHARED_SECRET
    BUILD_ID
    BUILD_COMMIT
    BUILD_VERSION
    REPO_URL
    REMOTE_TS
  )
  for key in "${keys[@]}"; do
    local value="${!key:-}"
    if [[ -n "${value}" ]]; then
      # Use printf %q to safely shell-quote.
      pairs+=("$(printf '%s=%q' "${key}" "${value}")")
    fi
  done
  printf '%s' "${pairs[*]}"
}

# rsync_lib_to_target — copy lib/ to /tmp/communication-install-<TS> on
# the target host. Idempotent (rsync only re-copies changed files).
rsync_lib_to_target() {
  require_env SSH_HOST
  info "Syncing scripts to ${SSH_HOST}:${REMOTE_DIR}"
  ssh_via_master "${SSH_HOST}" "mkdir -p '${REMOTE_DIR}/lib'"
  rsync_via_master --quiet --delete \
    "${LIB_DIR}/" \
    "${SSH_HOST}:${REMOTE_DIR}/lib/"
  ok "Scripts synced"
}

# stage_operator_ssh_keys_to_target — copy every ~/.ssh/*.pub on the
# operator's machine to ${REMOTE_DIR}/operator-ssh-keys/ on the target,
# so install-ssh-keys.sh can append them to /root/.ssh/authorized_keys.
#
# Hard error if the operator has no public keys locally — installing
# without keys would lock the host once disable-ssh-password-auth.sh
# runs.
stage_operator_ssh_keys_to_target() {
  require_env SSH_HOST
  local keys_glob="${HOME}/.ssh"

  shopt -s nullglob
  local local_keys=("${keys_glob}"/*.pub)
  shopt -u nullglob

  if [[ ${#local_keys[@]} -eq 0 ]]; then
    die "No public keys found in ${keys_glob}/*.pub. Generate one with 'ssh-keygen -t ed25519' before running install."
  fi

  info "Staging ${#local_keys[@]} operator SSH key(s) to ${SSH_HOST}:${REMOTE_DIR}/operator-ssh-keys/"
  ssh_via_master "${SSH_HOST}" "mkdir -p '${REMOTE_DIR}/operator-ssh-keys' && chmod 700 '${REMOTE_DIR}/operator-ssh-keys'"
  rsync_via_master --quiet \
    "${local_keys[@]}" \
    "${SSH_HOST}:${REMOTE_DIR}/operator-ssh-keys/"
  ok "Operator SSH keys staged"
}

# remote_run_script <name> — execute lib/<name>.sh on the target host
# with environment forwarded. Reuses the multiplexed ssh master.
remote_run_script() {
  local name="$1"
  require_env SSH_HOST
  info "Running on ${SSH_HOST}: ${name}"
  # shellcheck disable=SC2029
  ssh_via_master "${SSH_HOST}" "cd '${REMOTE_DIR}' && env $(env_for_remote) bash 'lib/${name}.sh'"
  ok "Done: ${name}"
}
