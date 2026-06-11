#!/usr/bin/env bash
# render-haproxy-cfg.sh — emit /etc/haproxy/haproxy.cfg for SNI routing.
# Skipped when --no-haproxy was passed.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

EDGE_HAPROXY_ENABLED="${EDGE_HAPROXY_ENABLED:-true}"
if [[ "${EDGE_HAPROXY_ENABLED}" != "true" ]]; then
  warn "HAProxy disabled (--no-haproxy) — skipping"
  exit 0
fi

# shellcheck disable=SC1091
source /etc/communication/deploy-vars

CFG_PATH="/etc/haproxy/haproxy.cfg"

info "Rendering ${CFG_PATH}"
cat > "${CFG_PATH}" <<HAPROXY
global
  log /dev/log local0
  maxconn 4096
  daemon

defaults
  mode tcp
  log global
  timeout connect 5s
  timeout client  1h
  timeout server  1h
  timeout tunnel  24h
  option dontlognull

frontend sni_router
  bind *:443
  mode tcp
  tcp-request inspect-delay 5s
  # Per-source connection rate limiting lives HERE, where real client IPs
  # are visible. The node app intentionally disables its own per-IP
  # accounting when edge.haproxy_enabled = true: behind TCP/SNI passthrough
  # it would see every client as 127.0.0.1 and one attacker's failures
  # would block all users (global-cap bug).
  stick-table type ip size 100k expire 10m store conn_rate(60s),conn_cur
  tcp-request connection track-sc0 src
  tcp-request connection reject if { sc0_conn_rate gt 60 }
  tcp-request connection reject if { sc0_conn_cur gt 20 }
  tcp-request content accept if { req.ssl_hello_type 1 }
  use_backend fastify if { req.ssl_sni -i -m str ${COMMUNICATION_DOMAIN} }
  use_backend coturn  if { req.ssl_sni -i -m str ${TURN_DOMAIN} }
  default_backend reject

# NOTE: send-proxy-v2 stays OFF — the node side does not parse PROXY
# protocol v2 (wiring it into the TLS-terminating server is non-trivial),
# so the backends see the loopback IP for every connection. Per-source
# protection is therefore enforced by the stick-table above; the node app
# skips its per-IP handshake accounting when edge.haproxy_enabled = true.
backend fastify
  mode tcp
  server fastify 127.0.0.1:8443

backend coturn
  mode tcp
  server coturn 127.0.0.1:5349

backend reject
  mode tcp
  tcp-request content reject
HAPROXY

info "Validating haproxy config"
haproxy -c -f "${CFG_PATH}"
ok "haproxy config valid"
