#!/usr/bin/env bash
# ensure-system-user.sh — create the dedicated `communication` system user.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

USER_NAME="communication"
USER_HOME="/opt/communication"

if id "${USER_NAME}" >/dev/null 2>&1; then
  ok "User '${USER_NAME}' already exists"
else
  info "Creating user '${USER_NAME}'"
  useradd -r -m -d "${USER_HOME}" -s /usr/sbin/nologin "${USER_NAME}"
  ok "User '${USER_NAME}' created"
fi

mkdir -p "${USER_HOME}"
chown "${USER_NAME}:${USER_NAME}" "${USER_HOME}"
ok "Home ${USER_HOME} owned by ${USER_NAME}"
