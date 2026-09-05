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
# - Runs as non-root user `communication` (uid 1001).
# - Builder pulls full deps; runtime stage installs --prod only.
# - Build with: bash apps/communication/scripts/docker-build.sh

# -----------------------------------------------------------------------------
# Stage 1: builder
# -----------------------------------------------------------------------------
FROM node:26-alpine AS builder

ENV PNPM_HOME=/root/.local/share/pnpm \
    PATH=/root/.local/share/pnpm:$PATH \
    CI=true

RUN apk add --no-cache git \
 && corepack enable \
 && corepack prepare pnpm@11.25.0 --activate

WORKDIR /workspace

# Workspace metadata (lockfile + every workspace's package.json) so that
# pnpm install can resolve the dependency graph deterministically.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/communication/package.json apps/communication/package.json
COPY libs/utils/package.json libs/utils/package.json
COPY libs/typescript-config/package.json libs/typescript-config/package.json

RUN pnpm install --frozen-lockfile --filter '@frozik/communication...'

# Copy only the workspace sources required to build communication.
COPY libs/utils libs/utils
COPY libs/typescript-config libs/typescript-config
COPY apps/communication apps/communication

RUN pnpm --filter @frozik/communication build

# Produce a minimal prod node_modules tree for the runtime stage.
RUN pnpm --filter @frozik/communication deploy --legacy --prod /out

# -----------------------------------------------------------------------------
# Stage 2: runtime
# -----------------------------------------------------------------------------
FROM node:26-alpine AS runtime

RUN addgroup -g 1001 -S communication \
 && adduser  -u 1001 -S -G communication -h /app -s /sbin/nologin communication

WORKDIR /app

# Bring across the deployed app — already contains dist/, config/ and
# a flat prod-only node_modules.
COPY --from=builder --chown=communication:communication /out/dist        ./dist
COPY --from=builder --chown=communication:communication /out/config      ./config
COPY --from=builder --chown=communication:communication /out/node_modules ./node_modules
COPY --from=builder --chown=communication:communication /out/package.json ./package.json

ENV NODE_ENV=production \
    NODE_CONFIG_DIR=/app/config \
    NODE_CONFIG_ENV=production \
    PORT=4445

USER communication

EXPOSE 4445 4446

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4445)+'/health/live',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["node", "dist/main.js"]
