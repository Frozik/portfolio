#!/usr/bin/env bash
# compose-up.sh — pull the published image and (re)start the stack.
#
# Replaces the old pull-repo/install-deps/build-app/graceful-restart chain:
# nothing is built on the box any more. `up -d` sends SIGTERM to the running
# container, waits out stop_grace_period so active calls drain, then starts
# the new one.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../lib/common.sh
source "${SCRIPT_DIR}/../../lib/common.sh"

COMPOSE_DIR="/opt/communication"
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"

mkdir -p "${COMPOSE_DIR}"
if [[ -f "${SCRIPT_DIR}/docker-compose.yml" ]]; then
  install -m 644 "${SCRIPT_DIR}/docker-compose.yml" "${COMPOSE_FILE}"
  ok "Installed ${COMPOSE_FILE}"
fi
[[ -f "${COMPOSE_FILE}" ]] || die "${COMPOSE_FILE} missing"

# FASTIFY_PUBLISH (and the image override, when set) come from deploy-vars.
if [[ -f /etc/communication/deploy-vars ]]; then
  # shellcheck disable=SC1091
  source /etc/communication/deploy-vars
  export FASTIFY_PORT FASTIFY_PUBLISH COMMUNICATION_IMAGE
fi

# COMMUNICATION_TAG may be exported by the caller to pin an exact image.
if [[ -n "${COMMUNICATION_TAG:-}" ]]; then
  info "Deploying tag ${COMMUNICATION_TAG}"
  export COMMUNICATION_TAG
fi

info "Pulling images"
docker compose -f "${COMPOSE_FILE}" pull --quiet

info "Starting stack"
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

docker compose -f "${COMPOSE_FILE}" ps
ok "Stack up"
