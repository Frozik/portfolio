#!/usr/bin/env bash
# hosts.sh — show the machines this repository knows how to provision.
#
#   hosts.sh              what is declared
#   hosts.sh --check      declared facts plus what each machine actually reports
#
# The two halves are deliberately separate: the file says what we intend, the
# --check column says what is true right now, and a mismatch between them is
# the interesting part.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=../lib/common.sh
source "${INFRA_DIR}/lib/common.sh"
# shellcheck source=../lib/hosts.sh
source "${INFRA_DIR}/lib/hosts.sh"

CHECK=false
[[ "${1:-}" == "--check" ]] && CHECK=true

probe() {
  local target="$1"
  ssh -o BatchMode=yes -o ConnectTimeout=8 "${target}" '
    image=$(docker inspect --format "{{index .Config.Labels \"org.opencontainers.image.revision\"}}" \
      "$(docker compose -f /opt/communication/docker-compose.yml images -q communication 2>/dev/null)" 2>/dev/null || true)
    cert=$(openssl x509 -in /etc/letsencrypt/live/communication/fullchain.pem -noout -enddate 2>/dev/null | cut -d= -f2)
    printf "kernel=%s|uptime=%s|disk=%s|deployed=%s|cert_until=%s\n" \
      "$(uname -r)" \
      "$(uptime -p 2>/dev/null | sed "s/^up //")" \
      "$(df -h / | awk "NR==2 {print \$3\"/\"\$2}")" \
      "${image:0:8}" \
      "${cert:-unknown}"
  ' 2>/dev/null || printf 'unreachable\n'
}

for name in $(list_hosts); do
  # Read the file in a subshell so one host's values never leak into the next.
  (
    load_host "${name}" >/dev/null
    printf '\n%s%s%s\n' "${COMMON_BLUE}" "${name}" "${COMMON_RESET}"
    printf '  ssh              %s\n' "${SSH_HOST:-—}"
    printf '  deploy target    %s\n' "${DEPLOY_SSH_TARGET:-—}"
    printf '  domain           %s\n' "${COMMUNICATION_DOMAIN:-—}"
    printf '  cors origins     %s\n' "${COMMUNICATION_CORS_ORIGINS:-—}"
    printf '  haproxy edge     %s\n' "${EDGE_HAPROXY_ENABLED:-—}"
    printf '  google client    %s\n' "${GOOGLE_OAUTH_CLIENT_ID:-—}"
    printf '  yandex client    %s\n' "${YANDEX_OAUTH_CLIENT_ID:-(disabled)}"
    printf '  cert email       %s\n' "${CERT_EMAIL:-(not recorded — pass --cert-email)}"

    if [[ "${CHECK}" == "true" ]]; then
      printf '  %s—— live ——%s\n' "${COMMON_YELLOW}" "${COMMON_RESET}"
      local_probe="$(probe "${SSH_HOST}")"
      if [[ "${local_probe}" == "unreachable" ]]; then
        printf '  %sunreachable over ssh%s\n' "${COMMON_RED}" "${COMMON_RESET}"
      else
        IFS='|' read -ra fields <<< "${local_probe}"
        for field in "${fields[@]}"; do
          printf '  %-16s %s\n' "${field%%=*}" "${field#*=}"
        done
      fi
    fi
  )
done

printf '\n'
