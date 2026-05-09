#!/usr/bin/env bash
# render-journald-conf.sh — cap journald disk usage at 2GB.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

CONF_DIR="/etc/systemd/journald.conf.d"
CONF_PATH="${CONF_DIR}/communication.conf"

mkdir -p "${CONF_DIR}"
info "Writing ${CONF_PATH}"
cat > "${CONF_PATH}" <<JOURNAL
[Journal]
SystemMaxUse=2G
JOURNAL

systemctl restart systemd-journald
ok "journald cap applied"
