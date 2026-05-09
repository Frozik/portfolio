#!/usr/bin/env bash
# render-systemd-unit.sh — install /etc/systemd/system/communication.service.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_env GOOGLE_OAUTH_CLIENT_ID

UNIT_PATH="/etc/systemd/system/communication.service"

info "Rendering ${UNIT_PATH}"
cat > "${UNIT_PATH}" <<UNIT
[Unit]
Description=Communication WebSocket server (command/response relay + WebRTC signaling)
After=network.target

[Service]
Type=simple
User=communication
WorkingDirectory=/opt/communication/apps/communication
EnvironmentFile=/etc/communication/turn-secret
Environment=NODE_CONFIG_DIR=/opt/communication/apps/communication/config
Environment=NODE_CONFIG_ENV=production
Environment=GOOGLE_OAUTH_CLIENT_ID=${GOOGLE_OAUTH_CLIENT_ID}
# Run source directly via tsx — handles TypeScript stripping AND
# extensionless ESM imports that Node strict ESM rejects natively.
# tsx is a runtime dep installed by 'pnpm install' in build-app.sh.
ExecStart=/opt/communication/node_modules/.bin/tsx /opt/communication/apps/communication/src/main.ts
Restart=always
RestartSec=5s
LimitNOFILE=65536
TimeoutStopSec=20s
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
ok "Systemd unit installed (not yet enabled)"
