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

# The navigation stack (tiles + routing) is optional: it exists only once
# install-navigation.sh has written navigation-vars. HAProxy stays a TCP/SNI
# passthrough for the signaling and TURN hosts, and terminates TLS itself
# only for the navigation host, whose upstreams speak plain HTTP.
NAV_VARS="/etc/communication/navigation-vars"
NAV_ENABLED=false
if [[ -f "${NAV_VARS}" ]]; then
  # shellcheck disable=SC1091
  source "${NAV_VARS}"
  NAV_ENABLED=true
fi

CFG_PATH="/etc/haproxy/haproxy.cfg"

render_nav_sni_route() {
  [[ "${NAV_ENABLED}" == "true" ]] || return 0
  printf '  use_backend nav_tls if { req.ssl_sni -i -m str %s }\n' "${NAV_DOMAIN}"
}

# The navigation host: SNI passthrough hands the raw TLS stream to a local
# HTTPS frontend that terminates it, answers CORS for the portfolio origins
# and routes /tiles/ to pmtiles and /route to GraphHopper.
render_nav_frontend() {
  [[ "${NAV_ENABLED}" == "true" ]] || return 0
  cat <<NAV

backend nav_tls
  mode tcp
  server nav_tls 127.0.0.1:${NAV_TLS_PORT}

frontend nav_https
  bind 127.0.0.1:${NAV_TLS_PORT} ssl crt /etc/haproxy/certs/nav.pem alpn h2,http/1.1
  mode http
  option httplog
  timeout client 30s
  acl allowed_origin req.hdr(origin) -m str https://frozik.github.io http://localhost:5173
  http-request set-var(txn.origin) req.hdr(origin) if allowed_origin
  http-request return status 204 hdr Access-Control-Allow-Origin %[var(txn.origin)] hdr Access-Control-Allow-Methods "GET, OPTIONS" hdr Access-Control-Allow-Headers "Content-Type" hdr Access-Control-Max-Age 86400 if METH_OPTIONS allowed_origin
  http-response set-header Access-Control-Allow-Origin %[var(txn.origin)] if { var(txn.origin) -m found }
  http-response set-header Vary Origin
  acl is_tiles path_beg /tiles/
  acl is_route path /route
  acl is_health path /health
  http-request return status 200 content-type text/plain string ok if is_health
  use_backend pmtiles if is_tiles
  use_backend graphhopper if is_route
  default_backend nav_not_found

backend pmtiles
  mode http
  timeout server 30s
  # The prefix is stripped here, after backend selection, so the frontend's
  # path ACL still sees /tiles/.
  http-request replace-path /tiles/(.*) /\1
  http-response set-header Cache-Control "public, max-age=86400"
  server pmtiles 127.0.0.1:${PMTILES_PORT}

backend graphhopper
  mode http
  timeout server 30s
  http-response set-header Cache-Control "no-store"
  server graphhopper 127.0.0.1:${GRAPHHOPPER_PORT}

backend nav_not_found
  mode http
  http-request return status 404 content-type text/plain string "not found"
NAV
}

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
$(render_nav_sni_route)
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
$(render_nav_frontend)
HAPROXY

info "Validating haproxy config"
haproxy -c -f "${CFG_PATH}"
ok "haproxy config valid"
