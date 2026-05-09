#!/usr/bin/env bash
# render-coturn-cfg.sh — write /etc/turnserver.conf with the shared secret
# from /etc/communication/turn-secret.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

# shellcheck disable=SC1091
source /etc/communication/deploy-vars
# shellcheck disable=SC1091
source /etc/communication/turn-secret
require_env TURN_SHARED_SECRET

CFG_PATH="/etc/turnserver.conf"
DH_PATH="/etc/coturn/dhparam.pem"

# Generate DH params (one-time, slow).
mkdir -p /etc/coturn
if [[ ! -s "${DH_PATH}" ]]; then
  warn "Generating ${DH_PATH} (2048-bit, slow)"
  openssl dhparam -out "${DH_PATH}" 2048 2>/dev/null
  ok "DH params generated"
fi

# In HAProxy mode coturn TLS is loopback-only (haproxy fronts it on :443).
# In direct mode it must listen on the public interface.
if [[ "${EDGE_HAPROXY_ENABLED}" == "true" ]]; then
  LISTENING_LINE="listening-ip=127.0.0.1"
else
  LISTENING_LINE="# listening-ip omitted — coturn binds public interface"
fi

info "Rendering ${CFG_PATH}"
cat > "${CFG_PATH}" <<COTURN
listening-port=3478
tls-listening-port=5349
${LISTENING_LINE}
external-ip=${COMMUNICATION_IP}
relay-ip=${COMMUNICATION_IP}
realm=${TURN_DOMAIN}
server-name=${TURN_DOMAIN}
use-auth-secret
static-auth-secret=${TURN_SHARED_SECRET}
total-quota=100
user-quota=4
max-bps=2000000
cert=/etc/letsencrypt/live/communication/fullchain.pem
pkey=/etc/letsencrypt/live/communication/privkey.pem
dh-file=/etc/coturn/dhparam.pem
no-tlsv1
no-tlsv1_1
cipher-list="ECDHE+AESGCM:ECDHE+CHACHA20:!aNULL:!MD5:!DSS"
ecdh-curve=prime256v1
no-stun-backward-compatibility
no-tcp-relay
no-multicast-peers
no-loopback-peers
no-cli
fingerprint
no-stdout-log
verbose=0
log-file=/var/log/coturn/turnserver.log
simple-log
# Block only the IPs that no legitimate WebRTC peer would ever have:
# IPv4 reserved/this-network, loopback, link-local, IETF doc/benchmark
# ranges, and IPv4 reserved/multicast. RFC1918 (10/8, 172.16/12,
# 192.168/16) + carrier-grade NAT (100.64/10) + IPv6 ULA (fc00::/7)
# are deliberately NOT blocked — they are legitimate client peer
# addresses behind home routers / mobile carriers. Our relay-ip is
# public (\${COMMUNICATION_IP}), so TURN-as-SSRF risk on RFC1918 is
# zero — the relay never sees the server's internal network.
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=192.0.0.0-192.0.0.255
denied-peer-ip=192.0.2.0-192.0.2.255
denied-peer-ip=198.18.0.0-198.19.255.255
denied-peer-ip=198.51.100.0-198.51.100.255
denied-peer-ip=203.0.113.0-203.0.113.255
denied-peer-ip=240.0.0.0-255.255.255.255
denied-peer-ip=::1
denied-peer-ip=fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff
COTURN
chmod 640 "${CFG_PATH}"
chown root:turnserver "${CFG_PATH}" 2>/dev/null || chown root:root "${CFG_PATH}"

mkdir -p /var/log/coturn
chown turnserver:turnserver /var/log/coturn 2>/dev/null || true

# Enable coturn (Debian/Ubuntu ship with TURNSERVER_ENABLED=0 by default).
if [[ -f /etc/default/coturn ]]; then
  sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
fi

ok "Wrote ${CFG_PATH}"
