#!/usr/bin/env bash
# journald.sh — bound the journal on disk.
#
# The default (10% of the filesystem, ~6 GB here) let the journal grow to
# 1.1 GB, which also inflated journald's own RSS to 140 MB. This box keeps
# weeks of logs for one service; a few hundred megabytes is plenty, and
# rsyslog still keeps plain-text copies under /var/log.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../lib/common.sh
source "${SCRIPT_DIR}/../../lib/common.sh"

CONF_DIR="/etc/systemd/journald.conf.d"
CONF_PATH="${CONF_DIR}/communication.conf"

mkdir -p "${CONF_DIR}"
info "Writing ${CONF_PATH}"
cat > "${CONF_PATH}" <<'JOURNAL'
[Journal]
# Total across all journal files.
SystemMaxUse=200M
# Free space journald must leave for everything else.
SystemKeepFree=1G
# Rotate at this size so no single file becomes unreadable-big.
SystemMaxFileSize=20M
# Drop anything older than a month even if the size cap is not reached.
MaxRetentionSec=1month
# Cap a single unit flooding the journal.
RateLimitIntervalSec=30s
RateLimitBurst=2000
JOURNAL

systemctl restart systemd-journald

info "Vacuuming the journal down to the new cap"
journalctl --vacuum-size=200M 2>&1 | tail -1
ok "journald capped at 200M (was using $(journalctl --disk-usage | grep -oP 'take up \K[0-9.]+[A-Z]+'))"
