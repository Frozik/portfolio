#!/usr/bin/env bash
# build-app.sh — install workspace deps and build @frozik/communication.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

USER_NAME="communication"
TARGET_DIR="/opt/communication"

info "Installing workspace dependencies"
sudo -u "${USER_NAME}" -H bash -c "cd '${TARGET_DIR}' && CI=true LEFTHOOK=0 pnpm install --frozen-lockfile"

# Pre-check: workspace project must actually exist. pnpm --filter
# against a missing project exits 0 with "No projects matched the
# filters", which would silently mask a stale clone.
if [[ ! -f "${TARGET_DIR}/apps/communication/package.json" ]]; then
  die "${TARGET_DIR}/apps/communication/package.json missing — the cloned ref does not contain apps/communication. Did you push the latest changes to the remote (REPO_URL=${REPO_URL:-https://github.com/frozik/portfolio.git})?"
fi

# Type-check only. The systemd service runs source directly via tsx
# (see render-systemd-unit.sh ExecStart) — no dist/ bundle is emitted
# for the systemd deployment; dist is built only for the Docker image
# (`pnpm build` in Dockerfile, consumed by `pnpm start`). The check
# catches type errors here so they fail the install loudly instead of
# crashing the service at boot.
info "Type-checking @frozik/communication"
sudo -u "${USER_NAME}" -H bash -c "cd '${TARGET_DIR}' && pnpm --filter @frozik/communication types"

# Sanity assert: src/main.ts (the actual entry point at runtime) is
# present.
ENTRY="${TARGET_DIR}/apps/communication/src/main.ts"
if [[ ! -f "${ENTRY}" ]]; then
  die "Expected entry ${ENTRY} not found. Repository is in an inconsistent state."
fi
ok "Type-check passed; entry: ${ENTRY}"
