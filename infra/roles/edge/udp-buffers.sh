#!/usr/bin/env bash
# udp-buffers.sh — socket buffers large enough for QUIC.
#
# HTTP/3 (the transport demo's WebTransport) runs over UDP, and a QUIC stack
# at a few tens of MB/s overruns Linux's default 208 KB receive buffer: the
# kernel drops datagrams, QUIC retransmits, throughput collapses. 7.5 MB is the
# floor quic-go and quiche document; the caps only allow a socket to ask for
# that much, nothing is allocated up front.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../lib/common.sh
source "${SCRIPT_DIR}/../../lib/common.sh"

CONF_PATH="/etc/sysctl.d/60-quic-buffers.conf"
BUFFER_BYTES=7500000

info "Writing ${CONF_PATH}"
cat > "${CONF_PATH}" <<SYSCTL
# Managed by infra/roles/edge/udp-buffers.sh
net.core.rmem_max = ${BUFFER_BYTES}
net.core.wmem_max = ${BUFFER_BYTES}
SYSCTL

sysctl --load "${CONF_PATH}" >/dev/null
ok "UDP socket buffers may grow to ${BUFFER_BYTES} bytes"
