#!/usr/bin/env bash
# deploy-user.sh — the unprivileged account GitHub Actions deploys through.
#
# The CI key gets no shell: its authorized_keys entry pins a forced command,
# and sudo is granted for that one wrapper and nothing else. A stolen key can
# therefore only trigger a deploy — no arbitrary command, no port forwarding,
# no agent forwarding.
#
# Skipped when DEPLOY_CI_PUBKEY is unset, so provisioning works before the
# key pair exists.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../lib/common.sh
source "${SCRIPT_DIR}/../../lib/common.sh"

DEPLOY_USER="deploy"
DEPLOY_HOME="/var/lib/deploy"
WRAPPER_PATH="/usr/local/bin/communication-deploy"
SUDOERS_PATH="/etc/sudoers.d/communication-deploy"
ROLE_DIR="/opt/infra/roles/communication"

# The wrapper runs role scripts from a fixed path, so they must live on the
# box rather than arrive with each deploy.
info "Installing role scripts to ${ROLE_DIR}"
mkdir -p "${ROLE_DIR}"
install -m 755 "${SCRIPT_DIR}/compose-up.sh" "${ROLE_DIR}/compose-up.sh"
install -m 755 "${SCRIPT_DIR}/smoke-test.sh" "${ROLE_DIR}/smoke-test.sh"
mkdir -p /opt/infra/lib
install -m 644 "${SCRIPT_DIR}/../../lib/common.sh" /opt/infra/lib/common.sh
install -m 644 "${SCRIPT_DIR}/docker-compose.yml" "${ROLE_DIR}/docker-compose.yml"

info "Installing ${WRAPPER_PATH}"
install -m 755 "${SCRIPT_DIR}/communication-deploy" "${WRAPPER_PATH}"

if ! id -u "${DEPLOY_USER}" >/dev/null 2>&1; then
  info "Creating user ${DEPLOY_USER}"
  useradd -r -m -d "${DEPLOY_HOME}" -s /bin/bash "${DEPLOY_USER}"
fi

info "Writing ${SUDOERS_PATH}"
# sudo's env_reset would drop SSH_ORIGINAL_COMMAND, and the wrapper would then
# always take the default branch instead of reading the verb sshd handed it.
# The value is attacker-controlled, which is why the wrapper matches it against
# a two-verb allowlist rather than executing it.
{
  printf 'Defaults:%s env_keep += "SSH_ORIGINAL_COMMAND"\n' "${DEPLOY_USER}"
  printf '%s ALL=(root) NOPASSWD: %s\n' "${DEPLOY_USER}" "${WRAPPER_PATH}"
} > "${SUDOERS_PATH}"
chmod 440 "${SUDOERS_PATH}"
visudo -cf "${SUDOERS_PATH}" >/dev/null || die "${SUDOERS_PATH} is not valid sudoers syntax"

if [[ -z "${DEPLOY_CI_PUBKEY:-}" ]]; then
  warn "DEPLOY_CI_PUBKEY not set — skipping authorized_keys (re-run once the CI key exists)"
  ok "Deploy user ready, no CI key installed yet"
  exit 0
fi

AUTH_DIR="${DEPLOY_HOME}/.ssh"
AUTH_KEYS="${AUTH_DIR}/authorized_keys"
RESTRICTIONS='command="sudo /usr/local/bin/communication-deploy",no-agent-forwarding,no-port-forwarding,no-pty,no-X11-forwarding,no-user-rc'

mkdir -p "${AUTH_DIR}"
chmod 700 "${AUTH_DIR}"
touch "${AUTH_KEYS}"

# Replace any previous CI entry rather than appending a second one.
KEY_BODY="$(printf '%s' "${DEPLOY_CI_PUBKEY}" | awk '{print $1" "$2}')"
grep -vF "${KEY_BODY}" "${AUTH_KEYS}" > "${AUTH_KEYS}.tmp" || true
printf '%s %s github-actions\n' "${RESTRICTIONS}" "${KEY_BODY}" >> "${AUTH_KEYS}.tmp"
mv "${AUTH_KEYS}.tmp" "${AUTH_KEYS}"

chmod 600 "${AUTH_KEYS}"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${AUTH_DIR}"
ok "CI key installed with a forced command"
