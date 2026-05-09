#!/usr/bin/env bash
# docker-build.sh — build the communication container from the repo root.
# Extra args are forwarded to `docker build`.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "${REPO_ROOT}"

docker build \
  -t communication:local \
  -f apps/communication/Dockerfile \
  "$@" \
  .
