#!/usr/bin/env bash
# ensure-redis.sh — install and start `redis-server`, bound to localhost
# only. Used by the v2 multi-node story; safe to skip when only running a
# single node (pass `--no-redis` to install.sh).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

REDIS_CONF_LINE="bind 127.0.0.1 ::1"
REDIS_CONF_PATH="/etc/redis/redis.conf"

info "Installing redis-server"
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq redis-server

# Ensure redis only listens on the loopback. Default Debian config already
# binds to 127.0.0.1, but we normalize defensively in case an older config
# is present.
if [[ -f "${REDIS_CONF_PATH}" ]]; then
  if ! grep -qE "^${REDIS_CONF_LINE}$" "${REDIS_CONF_PATH}"; then
    info "Pinning redis to localhost in ${REDIS_CONF_PATH}"
    # Replace any existing `bind` line; if none exists, append one.
    if grep -qE "^bind " "${REDIS_CONF_PATH}"; then
      sed -i "s|^bind .*|${REDIS_CONF_LINE}|" "${REDIS_CONF_PATH}"
    else
      printf '\n%s\n' "${REDIS_CONF_LINE}" >>"${REDIS_CONF_PATH}"
    fi
  fi
fi

systemctl enable --now redis-server >/dev/null 2>&1 || systemctl enable --now redis >/dev/null 2>&1 || true

if redis-cli -h 127.0.0.1 ping 2>/dev/null | grep -q PONG; then
  ok "redis-server is responding on 127.0.0.1:6379"
else
  warn "redis-server installed but ping did not return PONG — check 'systemctl status redis-server'"
fi
