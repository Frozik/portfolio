#!/usr/bin/env bash
# log-hygiene.sh — rotation for the log files Ubuntu leaves unbounded.
#
# Two files had run away on this box: /var/log/dmesg reached 77 MB because
# dmesg.service appends at every boot and nothing rotates it, and btmp had
# 25 MB of failed SSH logins (bruteforce noise — password auth is off, so the
# attempts are recorded and rejected). The stock rsyslog rotation also keeps
# more history than this box needs.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../lib/common.sh
source "${SCRIPT_DIR}/../../lib/common.sh"

CONF_PATH="/etc/logrotate.d/communication-hygiene"

info "Writing ${CONF_PATH}"
cat > "${CONF_PATH}" <<'ROTATE'
# Managed by infra/roles/edge/log-hygiene.sh

/var/log/dmesg {
    weekly
    rotate 2
    maxsize 5M
    missingok
    notifempty
    compress
    copytruncate
}

/var/log/btmp {
    weekly
    rotate 2
    maxsize 2M
    missingok
    notifempty
    compress
    create 0660 root utmp
}

/var/log/syslog
/var/log/kern.log
/var/log/auth.log
/var/log/ufw.log {
    daily
    rotate 7
    maxsize 20M
    missingok
    notifempty
    compress
    delaycompress
    sharedscripts
    postrotate
        /usr/lib/rsyslog/rsyslog-rotate 2>/dev/null || true
    endscript
}
ROTATE
chmod 644 "${CONF_PATH}"

# sysstat keeps a month of binary activity files by default.
if [[ -f /etc/sysstat/sysstat ]]; then
  sed -i 's/^HISTORY=.*/HISTORY=7/' /etc/sysstat/sysstat
  ok "sysstat history reduced to 7 days"
fi

info "Validating the logrotate config"
logrotate --debug "${CONF_PATH}" >/dev/null

info "Forcing one rotation now to reclaim what has already piled up"
logrotate --force "${CONF_PATH}"

ok "Log rotation configured"
