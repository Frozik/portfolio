#!/usr/bin/env bash
# sync.md §8.6 — the storage contract against a real WebDAV server: rclone in Docker.
set -euo pipefail

readonly CONTAINER="pwv-webdav-contract-$$"
readonly PORT="${WEBDAV_CONTRACT_PORT:-18089}"
readonly IMAGE="rclone/rclone:1.75.2"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --rm --name "$CONTAINER" -p "127.0.0.1:${PORT}:8080" "$IMAGE" \
  serve webdav /data --addr :8080 --user contract --pass contract --allow-origin '*' >/dev/null

for _ in $(seq 1 30); do
  if curl -fs -o /dev/null -u contract:contract -X PROPFIND -H 'Depth: 0' "http://127.0.0.1:${PORT}/"; then
    break
  fi
  sleep 1
done

cd "$(dirname "$0")/../../.."
WEBDAV_CONTRACT_URL="http://contract:contract@127.0.0.1:${PORT}/" \
  pnpm exec vitest run --project cloud-storage libs/cloud-storage/src/webdav/webdav-provider.rclone.test.ts
