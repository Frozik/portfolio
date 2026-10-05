#!/usr/bin/env bash
# compose-up.sh — install the stack of the image being deployed and (re)start it.
#
# The compose file ships inside the communication image (/deploy), so the
# deploy of a commit — rollback included — starts exactly that commit's stack:
# the Node app and the HTTP/3 gateway, both tagged with the same sha. `up -d`
# sends SIGTERM to the running containers, waits out stop_grace_period so
# active calls drain, then starts the new ones.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../lib/common.sh
source "${SCRIPT_DIR}/../../lib/common.sh"

COMPOSE_DIR="/opt/communication"
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"
STACK_FILE_IN_IMAGE="/deploy/docker-compose.yml"

# FASTIFY_PUBLISH (and the image overrides, when set) come from deploy-vars.
if [[ -f /etc/communication/deploy-vars ]]; then
  # shellcheck disable=SC1091
  source /etc/communication/deploy-vars
fi
COMMUNICATION_IMAGE="${COMMUNICATION_IMAGE:-ghcr.io/frozik/communication}"
GATEWAY_IMAGE="${GATEWAY_IMAGE:-ghcr.io/frozik/transport-gateway}"
# COMMUNICATION_TAG may be exported by the caller to pin an exact commit; the
# gateway always runs the image built from the same commit.
COMMUNICATION_TAG="${COMMUNICATION_TAG:-latest}"
GATEWAY_TAG="${GATEWAY_TAG:-${COMMUNICATION_TAG}}"
export FASTIFY_PORT FASTIFY_PUBLISH COMMUNICATION_IMAGE COMMUNICATION_TAG GATEWAY_IMAGE GATEWAY_TAG

# A commit's image never changes, so one already here need not be fetched
# again; `latest` moves and always is.
pull_policy=missing
[[ "${COMMUNICATION_TAG}" == "latest" ]] && pull_policy=always

image="${COMMUNICATION_IMAGE}:${COMMUNICATION_TAG}"
info "Deploying ${image} with ${GATEWAY_IMAGE}:${GATEWAY_TAG}"
if [[ "${pull_policy}" == "always" ]] || ! docker image inspect "${image}" >/dev/null 2>&1; then
  docker pull --quiet "${image}" >/dev/null
fi

mkdir -p "${COMPOSE_DIR}"
staged=""
container=""
trap '[[ -n "${container}" ]] && docker rm -f "${container}" >/dev/null 2>&1; rm -f "${staged}"' EXIT
staged="$(mktemp "${COMPOSE_DIR}/docker-compose.XXXXXX")"
container="$(docker create "${image}")"
docker cp "${container}:${STACK_FILE_IN_IMAGE}" "${staged}"
docker compose -f "${staged}" config --quiet || die "the compose file in ${image} does not validate"
# Kept for a hand rollback past the change that moved the stack into the
# image: images from before it carry no compose file to extract.
[[ -f "${COMPOSE_FILE}" ]] && cp "${COMPOSE_FILE}" "${COMPOSE_FILE}.previous"
install -m 644 "${staged}" "${COMPOSE_FILE}"
ok "Installed ${COMPOSE_FILE} from ${image}"

info "Starting stack"
docker compose -f "${COMPOSE_FILE}" up -d --pull "${pull_policy}" --remove-orphans
