#!/usr/bin/env bash
# ensure-system-packages.sh — idempotent install of OS-level dependencies.
# The app ships as a container image, so no Node, pnpm or git here:
# nothing is built on this box (see install-docker.sh).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../lib/common.sh
source "${SCRIPT_DIR}/../../lib/common.sh"

info "apt-get update"
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  ca-certificates \
  curl \
  gnupg \
  haproxy \
  coturn \
  certbot \
  systemd-timesyncd \
  ufw \
  openssl

# Time sync — required for OAuth clock skew + TURN credential validation.
systemctl enable --now systemd-timesyncd >/dev/null 2>&1 || true
ok "systemd-timesyncd active"
