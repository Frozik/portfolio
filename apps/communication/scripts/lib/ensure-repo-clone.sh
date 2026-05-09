#!/usr/bin/env bash
# ensure-repo-clone.sh — clone or fast-forward the portfolio repo.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

USER_NAME="communication"
TARGET_DIR="/opt/communication"
REPO_URL="${REPO_URL:-https://github.com/frozik/portfolio.git}"

if [[ -d "${TARGET_DIR}/.git" ]]; then
  info "Repository already cloned — pulling"
  sudo -u "${USER_NAME}" -H git -C "${TARGET_DIR}" pull --ff-only
  ok "Repository up to date"
else
  info "Cloning ${REPO_URL} into ${TARGET_DIR}"
  # Wipe any orphan dotfiles (e.g. skeleton from useradd --create-home),
  # but never touch an existing .git.
  find "${TARGET_DIR}" -mindepth 1 -delete 2>/dev/null || true
  sudo -u "${USER_NAME}" -H git clone "${REPO_URL}" "${TARGET_DIR}"
  ok "Cloned"
fi
