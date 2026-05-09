#!/usr/bin/env bash
# install-deps.sh — pnpm install --frozen-lockfile inside the workspace.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

USER_NAME="communication"
TARGET_DIR="/opt/communication"

info "pnpm install --frozen-lockfile"
sudo -u "${USER_NAME}" -H bash -c "cd '${TARGET_DIR}' && pnpm install --frozen-lockfile"
ok "Dependencies installed"
