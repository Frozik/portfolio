#!/usr/bin/env bash
# install-ssh-keys.sh — append every operator public key staged at
# ${REMOTE_DIR}/operator-ssh-keys/*.pub to /root/.ssh/authorized_keys.
#
# Idempotent: existing keys are preserved, duplicates are deduped by
# exact-line match. Append-only; never removes keys.
#
# Pre-staging is the orchestrator's responsibility (see remote-run.sh
# stage_operator_ssh_keys_to_target). Without staged keys this is a hard
# error — the install would otherwise lock you out once
# disable-ssh-password-auth.sh runs.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_env REMOTE_TS

KEYS_DIR="/tmp/communication-install-${REMOTE_TS}/operator-ssh-keys"

if [[ ! -d "${KEYS_DIR}" ]]; then
  die "Operator SSH keys not staged at ${KEYS_DIR}. Did the orchestrator run stage_operator_ssh_keys_to_target?"
fi

shopt -s nullglob
keys=("${KEYS_DIR}"/*.pub)
shopt -u nullglob

if [[ ${#keys[@]} -eq 0 ]]; then
  die "No *.pub files found in ${KEYS_DIR}. Operator's local ~/.ssh/*.pub is empty."
fi

mkdir -p /root/.ssh
chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

added=0
skipped=0

for keyfile in "${keys[@]}"; do
  while IFS= read -r line || [[ -n "${line}" ]]; do
    # Skip empty lines and comments.
    if [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]]; then
      continue
    fi
    if grep -qxF "${line}" /root/.ssh/authorized_keys; then
      skipped=$((skipped + 1))
    else
      printf '%s\n' "${line}" >> /root/.ssh/authorized_keys
      added=$((added + 1))
    fi
  done < "${keyfile}"
done

ok "SSH keys: ${added} added, ${skipped} already present in /root/.ssh/authorized_keys"
