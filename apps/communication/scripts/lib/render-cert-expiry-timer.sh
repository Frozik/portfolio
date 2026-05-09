#!/usr/bin/env bash
# render-cert-expiry-timer.sh — emit a daily systemd timer that warns to
# journald when the communication cert is within 7 days of expiry.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

SERVICE_PATH="/etc/systemd/system/communication-cert-check.service"
TIMER_PATH="/etc/systemd/system/communication-cert-check.timer"
SCRIPT_PATH="/usr/local/sbin/communication-cert-check"

info "Writing ${SCRIPT_PATH}"
cat > "${SCRIPT_PATH}" <<'SCRIPT'
#!/bin/sh
# Warn (via stderr -> journald) if the cert expires within 7 days.
set -eu
CERT="/etc/letsencrypt/live/communication/fullchain.pem"
if [ ! -f "${CERT}" ]; then
  echo "communication-cert-check: ${CERT} missing" >&2
  exit 1
fi
if openssl x509 -checkend $((7*86400)) -noout -in "${CERT}"; then
  echo "communication-cert-check: cert valid for >7 days"
  exit 0
fi
echo "communication-cert-check: WARNING cert expires within 7 days" >&2
exit 1
SCRIPT
chmod 755 "${SCRIPT_PATH}"

info "Writing ${SERVICE_PATH}"
cat > "${SERVICE_PATH}" <<UNIT
[Unit]
Description=Communication TLS cert expiry check

[Service]
Type=oneshot
ExecStart=${SCRIPT_PATH}
UNIT

info "Writing ${TIMER_PATH}"
cat > "${TIMER_PATH}" <<TIMER
[Unit]
Description=Run communication cert expiry check daily

[Timer]
OnCalendar=daily
Persistent=true
RandomizedDelaySec=30m
Unit=communication-cert-check.service

[Install]
WantedBy=timers.target
TIMER

systemctl daemon-reload
systemctl enable --now communication-cert-check.timer
ok "Cert-expiry timer installed and enabled"
