#!/usr/bin/env bash
# ensure-system-packages.sh — idempotent install of OS-level dependencies.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

PNPM_VERSION="${PNPM_VERSION:-11.25.0}"

info "apt-get update"
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  ca-certificates \
  curl \
  git \
  gnupg \
  haproxy \
  coturn \
  certbot \
  systemd-timesyncd \
  ufw \
  openssl

# Node.js 24 — install via NodeSource if absent or older (the workspace declares engines.node >= 24).
if ! command -v node >/dev/null 2>&1 || [[ "$(node --version | sed 's/^v\([0-9]*\).*/\1/')" -lt 24 ]]; then
  info "Installing Node.js 24"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs
fi
ok "Node $(node --version)"

# pnpm via corepack.
if ! command -v pnpm >/dev/null 2>&1 || [[ "$(pnpm --version)" != "${PNPM_VERSION}" ]]; then
  info "Activating pnpm ${PNPM_VERSION}"
  corepack enable
  corepack prepare "pnpm@${PNPM_VERSION}" --activate
fi
ok "pnpm $(pnpm --version)"

# Time sync — required for OAuth clock skew + TURN credential validation.
systemctl enable --now systemd-timesyncd >/dev/null 2>&1 || true
ok "systemd-timesyncd active"
