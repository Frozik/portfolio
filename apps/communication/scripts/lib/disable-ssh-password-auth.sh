#!/usr/bin/env bash
# disable-ssh-password-auth.sh — disable SSH password login. Key-only
# from this point forward.
#
# Writes a drop-in to /etc/ssh/sshd_config.d/01-communication.conf and
# removes any other drop-in that re-enables password auth (notably
# Ubuntu cloud-init's `50-cloud-init.conf` which ships with
# `PasswordAuthentication yes`). Drop-ins are loaded alphabetically and
# OpenSSH applies the FIRST setting it sees for each option, so:
#   01-communication.conf — our hardening, evaluated first → wins
#   /etc/ssh/sshd_config   — main config; our drop-in beats it
#
# Validates with `sshd -t` before reloading; on validation failure the
# drop-in is removed so we never leave the host with a broken sshd
# config.
#
# Safety gate: refuses to run unless /root/.ssh/authorized_keys already
# contains at least one key — otherwise we would lock ourselves out.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

if [[ ! -s /root/.ssh/authorized_keys ]]; then
  die "/root/.ssh/authorized_keys is empty. Refusing to disable password auth (would lock you out). Run install-ssh-keys.sh first."
fi

DROPIN_DIR=/etc/ssh/sshd_config.d
DROPIN="${DROPIN_DIR}/01-communication.conf"
LEGACY_DROPIN="${DROPIN_DIR}/50-communication.conf"

mkdir -p "${DROPIN_DIR}"

# Earlier installs of this script wrote `50-communication.conf`. That
# name was lexically EQUAL to or AFTER cloud-init's `50-cloud-init.conf`
# (which ships `PasswordAuthentication yes`), so cloud-init's value
# won by first-match precedence. Migrate any leftover from older runs
# to the new name and drop the cloud-init file.
if [[ -f "${LEGACY_DROPIN}" && ! -f "${DROPIN}" ]]; then
  mv "${LEGACY_DROPIN}" "${DROPIN}"
fi
rm -f "${LEGACY_DROPIN}"
rm -f "${DROPIN_DIR}/50-cloud-init.conf"

DESIRED=$(cat <<'EOF'
# Managed by apps/communication/scripts/lib/disable-ssh-password-auth.sh
# Do NOT edit by hand; re-run install.sh to regenerate.
PasswordAuthentication no
PermitRootLogin prohibit-password
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
EOF
)

# Idempotent: skip reload if drop-in already has the desired content.
if [[ -f "${DROPIN}" ]] && diff -q <(printf '%s\n' "${DESIRED}") "${DROPIN}" > /dev/null 2>&1; then
  ok "SSH password auth already disabled (drop-in unchanged); skipping reload"
  exit 0
fi

# Stash the previous file (if any) so we can revert on validation failure.
if [[ -f "${DROPIN}" ]]; then
  cp "${DROPIN}" "${DROPIN}.prev"
fi

printf '%s\n' "${DESIRED}" > "${DROPIN}"
chmod 644 "${DROPIN}"

if ! sshd -t 2>/dev/null; then
  err "sshd config validation failed; reverting"
  if [[ -f "${DROPIN}.prev" ]]; then
    mv "${DROPIN}.prev" "${DROPIN}"
  else
    rm -f "${DROPIN}"
  fi
  die "Aborted disable-ssh-password-auth: sshd -t failed"
fi

rm -f "${DROPIN}.prev"

# Service name varies across Ubuntu / Debian releases.
if systemctl list-unit-files ssh.service > /dev/null 2>&1; then
  systemctl reload ssh
elif systemctl list-unit-files sshd.service > /dev/null 2>&1; then
  systemctl reload sshd
else
  die "Neither ssh.service nor sshd.service found"
fi

ok "SSH password authentication disabled. Key-only login from now on (root via prohibit-password)."
