#!/usr/bin/env bash
# install-deps.sh — pnpm install --frozen-lockfile inside the workspace.
# CI=true: a deploy has no TTY, and pnpm otherwise stops to ask before
# rebuilding a modules directory laid out by an older pnpm. LEFTHOOK=0: the
# workspace's prepare script installs git hooks, which a deploy clone has no
# use for and which fail when the clone carries a stale core.hooksPath.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

USER_NAME="communication"
TARGET_DIR="/opt/communication"

info "pnpm install --frozen-lockfile"
sudo -u "${USER_NAME}" -H bash -c "cd '${TARGET_DIR}' && CI=true LEFTHOOK=0 pnpm install --frozen-lockfile"
ok "Dependencies installed"
