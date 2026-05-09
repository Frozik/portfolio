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
  tcp-request content accept if { req.ssl_hello_type 1 }
  use_backend fastify if { req.ssl_sni -i -m str ${COMMUNICATION_DOMAIN} }
  use_backend coturn  if { req.ssl_sni -i -m str ${TURN_DOMAIN} }
  default_backend reject

# NOTE: send-proxy-v2 is intentionally OFF in v1 — Fastify currently
# does not parse PROXY protocol v2 (proxy-protocol-js is in deps but
# the bootstrap wiring is deferred to v2.x). Without it the backends
# see HAProxy's loopback IP for every connection — per-IP rate-limit
# (M11) effectively becomes a global cap. Acceptable for personal
# scale; revisit when the parser is wired.
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
