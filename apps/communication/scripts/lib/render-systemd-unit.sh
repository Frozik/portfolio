#!/usr/bin/env bash
# render-systemd-unit.sh — install /etc/systemd/system/communication.service.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_env GOOGLE_OAUTH_CLIENT_ID

UNIT_PATH="/etc/systemd/system/communication.service"

# Public-id env entries. Yandex client_id is included only when set so
# the unit file stays clean for Google-only deploys.
PUBLIC_ID_ENV_LINES="Environment=GOOGLE_OAUTH_CLIENT_ID=${GOOGLE_OAUTH_CLIENT_ID}"
if [[ -n "${YANDEX_OAUTH_CLIENT_ID:-}" ]]; then
  PUBLIC_ID_ENV_LINES="${PUBLIC_ID_ENV_LINES}
Environment=YANDEX_OAUTH_CLIENT_ID=${YANDEX_OAUTH_CLIENT_ID}"
fi

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
# Optional — leading dash makes systemd treat a missing file as no-op.
# render-oauth-secrets.sh writes this only when at least one provider
# secret is configured (Yandex today).
EnvironmentFile=-/etc/communication/oauth-secrets
Environment=NODE_CONFIG_DIR=/opt/communication/apps/communication/config
Environment=NODE_CONFIG_ENV=production
${PUBLIC_ID_ENV_LINES}
# Run source directly via tsx — handles TypeScript stripping AND
# extensionless ESM imports that Node strict ESM rejects natively.
# tsx is a dependency of apps/communication alone, so its bin lives in that
# package's node_modules, not at the workspace root.
ExecStart=/opt/communication/apps/communication/node_modules/.bin/tsx /opt/communication/apps/communication/src/main.ts
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
