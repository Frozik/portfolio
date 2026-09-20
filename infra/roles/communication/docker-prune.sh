#!/usr/bin/env bash
# docker-prune.sh — weekly reclaim of superseded images.
#
# Every deploy pulls a new tag and leaves the previous one behind. A couple of
# old images are worth keeping for a fast rollback; everything older than 30
# days is not.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../lib/common.sh
source "${SCRIPT_DIR}/../../lib/common.sh"

info "Writing docker-prune.service and .timer"
cat > /etc/systemd/system/docker-prune.service <<'UNIT'
[Unit]
Description=Reclaim Docker images no container has used for 30 days
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/bin/docker image prune -af --filter until=720h
ExecStart=/usr/bin/docker builder prune -af --filter unused-for=720h
UNIT

cat > /etc/systemd/system/docker-prune.timer <<'UNIT'
[Unit]
Description=Weekly Docker image reclaim

[Timer]
OnCalendar=weekly
Persistent=true
RandomizedDelaySec=1h

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now docker-prune.timer
ok "docker-prune.timer enabled ($(systemctl show -p NextElapseUSecRealtime --value docker-prune.timer))"
