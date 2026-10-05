#!/usr/bin/env bash
# gateway-secret.sh — create /etc/communication/gateway-secret if absent: the
# secret the HTTP/3 gateway proves itself with to the communication container.
# Both containers read it as an env_file.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../lib/common.sh
source "${SCRIPT_DIR}/../../lib/common.sh"

SECRETS_DIR="/etc/communication"
SECRET_FILE="${SECRETS_DIR}/gateway-secret"

mkdir -p "${SECRETS_DIR}"
chmod 750 "${SECRETS_DIR}"

if [[ -s "${SECRET_FILE}" ]]; then
  ok "Gateway secret already exists at ${SECRET_FILE}"
else
  info "Generating the gateway secret"
  printf 'TRANSPORT_GATEWAY_SECRET=%s\n' "$(openssl rand -hex 32)" > "${SECRET_FILE}"
  chmod 600 "${SECRET_FILE}"
  ok "Wrote ${SECRET_FILE}"
fi
