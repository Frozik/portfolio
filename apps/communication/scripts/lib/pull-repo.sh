#!/usr/bin/env bash
# pull-repo.sh — fast-forward /opt/communication to latest origin.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

USER_NAME="communication"
TARGET_DIR="/opt/communication"

if [[ ! -d "${TARGET_DIR}/.git" ]]; then
  die "${TARGET_DIR} is not a git checkout — run install.sh first"
fi

info "git pull --ff-only"
sudo -u "${USER_NAME}" -H git -C "${TARGET_DIR}" pull --ff-only
ok "Repository updated"
