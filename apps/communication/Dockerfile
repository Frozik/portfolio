# syntax=docker/dockerfile:1.7
#
# Communication server — multi-stage build.
#
# Recommended invocation (read-only root, ephemeral /tmp):
#   docker run --read-only --tmpfs /tmp:rw,nosuid,size=64m \
#     -p 4445:4445 -p 4446:4446 \
#     -e GOOGLE_OAUTH_CLIENT_ID=... \
#     -e TURN_SHARED_SECRET=... \
#     communication:local
#
# Notes:
# - Debian (glibc), not Alpine: the HTTP/3 stack is a native addon whose
#   prebuilt binary needs glibc >= 2.38, i.e. Debian 13 (trixie).
# - Runs as non-root user `communication` (uid 1001).
# - Builder pulls full deps; runtime stage installs --prod only.
# - Build with: bash apps/communication/scripts/docker-build.sh

# -----------------------------------------------------------------------------
# Stage 1: builder
# -----------------------------------------------------------------------------
FROM node:24-trixie-slim AS builder

ENV PNPM_HOME=/root/.local/share/pnpm \
    PATH=/root/.local/share/pnpm:$PATH \
    CI=true

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable \
 && corepack prepare pnpm@11.25.0 --activate

WORKDIR /workspace

# Workspace metadata (lockfile + every workspace's package.json) so that
# pnpm install can resolve the dependency graph deterministically.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# pnpm-workspace.yaml applies these patches on install (fails-components backpressure).
COPY patches patches
COPY apps/communication/package.json apps/communication/package.json
COPY libs/utils/package.json libs/utils/package.json
COPY libs/communication-protocol/package.json libs/communication-protocol/package.json
COPY libs/transport/package.json libs/transport/package.json
COPY libs/proto/package.json libs/proto/package.json
COPY libs/typescript-config/package.json libs/typescript-config/package.json
# The root manifest depends on it; `pnpm deploy` resolves the whole workspace.
COPY libs/tooling/package.json libs/tooling/package.json

# --ignore-scripts: the root `prepare` (lefthook install) needs a git checkout, and
# the build needs no install script. The runtime tree below does run them.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter '@frozik/communication...'

# Copy only the workspace sources required to build communication.
COPY libs/utils libs/utils
COPY libs/communication-protocol libs/communication-protocol
COPY libs/transport libs/transport
COPY libs/proto libs/proto
COPY libs/typescript-config libs/typescript-config
COPY apps/communication apps/communication

RUN pnpm --filter @frozik/communication build

# A minimal prod node_modules tree for the runtime stage. Hoisted (flat), because
# the bundle keeps the workspace libs' npm dependencies external and Node must
# find them from dist/. Scripts stay off (the root `prepare` needs git); the one
# that matters runs on its own: the HTTP/3 addon downloads its prebuilt binary.
RUN pnpm --filter @frozik/communication deploy --legacy --prod --ignore-scripts --config.node-linker=hoisted /out \
 && cd /out/node_modules/@fails-components/webtransport-transport-http3-quiche \
 && PATH="/out/node_modules/.bin:$PATH" node build.js install

# -----------------------------------------------------------------------------
# Stage 2: runtime
# -----------------------------------------------------------------------------
FROM node:24-trixie-slim AS runtime

RUN groupadd --system --gid 1001 communication \
 && useradd --system --uid 1001 --gid communication --home-dir /app --shell /usr/sbin/nologin communication

WORKDIR /app

# Bring across the deployed app — already contains dist/, config/ and
# a flat prod-only node_modules.
COPY --from=builder --chown=communication:communication /out/dist        ./dist
COPY --from=builder --chown=communication:communication /out/config      ./config
COPY --from=builder --chown=communication:communication /out/node_modules ./node_modules
COPY --from=builder --chown=communication:communication /out/package.json ./package.json

ENV NODE_ENV=production \
    NODE_CONFIG_DIR=/app/config \
    NODE_CONFIG_ENV=production

USER communication

# 8443/tcp: HTTPS, Socket.IO and the transport's WebSocket fallback (behind HAProxy).
# 4447/udp: HTTP/3 WebTransport, published straight to the host's UDP 443.
EXPOSE 8443 4447/udp

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('https').get({host:'127.0.0.1',port:process.env.PORT||8443,path:'/health/live',rejectUnauthorized:false},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["node", "dist/main.js"]
