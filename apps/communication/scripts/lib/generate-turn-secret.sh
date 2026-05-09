#!/usr/bin/env bash
# generate-turn-secret.sh — create /etc/communication/turn-secret if absent.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

SECRETS_DIR="/etc/communication"
SECRET_FILE="${SECRETS_DIR}/turn-secret"

mkdir -p "${SECRETS_DIR}"
chmod 750 "${SECRETS_DIR}"
chown root:communication "${SECRETS_DIR}" 2>/dev/null || true

if [[ -s "${SECRET_FILE}" ]]; then
  ok "TURN secret already exists at ${SECRET_FILE}"
else
  info "Generating new TURN shared secret"
  local_secret="$(openssl rand -hex 32)"
  printf 'TURN_SHARED_SECRET=%s\n' "${local_secret}" > "${SECRET_FILE}"
  chmod 640 "${SECRET_FILE}"
  chown root:communication "${SECRET_FILE}"
  ok "Wrote ${SECRET_FILE}"
fi

# Export for downstream scripts running in the same env (e.g. coturn cfg).
# shellcheck disable=SC1090
source "${SECRET_FILE}"
export TURN_SHARED_SECRET
