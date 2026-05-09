  # Communication Server — Implementation Plan

> **Status:** Architecture proposal, awaiting user approval. **No code written.**
> **Author:** software-architect agent.
> **Scope:** New Node.js server `apps/communication/` — Fastify 5 + Socket.IO 4 relay
> for room-scoped command/response routing between **authenticated** browser clients.

---

## 1. Goal & Non-Goals

### Goal
A small, stateless WebSocket relay that lets two-or-more **authenticated**
browser clients in the same UUID-identified room exchange request/response
pairs:

1. Each client authenticates at handshake with a Google **OpenID Connect**
   ID token plus a self-chosen `displayName`. Unauthenticated connections are
   rejected.
2. An *initiator* emits a single command into a room.
3. The server tells the initiator how many other listeners are present and who
   they are (their `Identity` records).
4. The server fans the command out to every other client in the room.
5. Each responder's reply is forwarded back to the initiator individually as
   it arrives (no batching), tagged with the responder's `Identity`.
6. The server emits live participant updates (count + `users[]`) whenever
   someone joins or leaves the room.
7. The server tracks each connection's ID-token expiry. ~60 s before expiry it
   sends an `auth:token-expiring` warning. At expiry it emits
   `auth:token-expired` and disconnects. The client may pre-emptively send
   `auth:refresh-token` with a fresh ID token to reset the timer.
8. Configuration is loaded from layered TOML files via the `node-config`
   library, validated with zod into a typed `IServerConfig`, and injected
   through DI. Environment variables override TOML keys via
   `custom-environment-variables.json`.
9. **WebRTC signaling protocol — replaces `apps/signaling` (server-side
   only in v1).** The same Socket.IO connection that carries commands also
   carries a thin `signal:publish` / `signal:event` pub-sub used by browser
   peers to exchange WebRTC SDP offers/answers and ICE candidates. Server
   is an opaque relay (no payload inspection). All signaling is under OIDC
   — anonymous signaling (the `apps/signaling` behaviour) is removed.
10. **TURN/STUN relay via `coturn`.** A `coturn` instance runs on the same
    VM, providing STUN reflexive-address discovery and TURN media relay
    for peers behind symmetric NATs. No long-term static credentials —
    every cred is HMAC-SHA1-derived and short-lived (RFC 7635 / coturn
    `--use-auth-secret`).
11. **Edge TLS routing via HAProxy SNI passthrough.** A single Let's
    Encrypt SAN cert covers `<IP>.sslip.io` (Fastify) and
    `turn-<IP>.sslip.io` (coturn TLS). HAProxy on `:443` does Layer-4 SNI
    inspection and routes to `127.0.0.1:8443` (Fastify TLS) or
    `127.0.0.1:5349` (coturn TLS) without terminating TLS itself.
12. **Ephemeral TURN credential issuance.** Authenticated clients request
    TURN credentials over the WebSocket (`turn:request-credentials`); the
    server responds with `{ username, credential, ttl, urls }` derived
    from the shared secret. Credentials are valid for `ttl_seconds`
    (default 3600 s) and immediately usable by `coturn`.

### Non-Goals (v1)
- No persistence. Rooms are pure in-memory; a server restart drops all rooms.
- No clustering / horizontal scaling. Single-process, single-node.
- No message history / replay. The server forwards live traffic only.
- No PaaS-specific deployment config beyond a portable Dockerfile.
- **Frontend migration of `retro` / `conf` features off `apps/signaling`
  to the new server is deferred to v1.1 (a separate follow-up PR).**
  v1 ships server-side only: the new signaling protocol, the deployment
  infrastructure (HAProxy + coturn + sslip.io + SAN cert), and the TURN
  credential endpoint. `apps/signaling` continues to run during the
  transition and is only deleted in v1.2 once v1.1 frontend migration is
  complete.
- No per-command re-validation of tokens. We validate at handshake and on
  refresh; in-flight commands trust the connection.
- **Long-term static TURN credentials are NEVER supported** — only HMAC
  ephemeral creds. This is a deliberate security choice; do not add a
  static-creds fallback.
- **STUN-only mode (no TURN) is not supported** — `coturn` always provides
  both. Operators who refuse to run `coturn` simply lose WebRTC
  connectivity for NATed peers; they may not configure STUN-only.
- **Client integration in `apps/portfolio` is out of scope for this PR
  (m14).** A follow-up PR will add a `useCommunicationRoom()` hook in
  a new feature inside `apps/portfolio/src/features/`.
- **SDP-aware features (call quality metrics, codec negotiation hints)
  are out of scope.** The signaling relay stays opaque to keep the
  protocol drop-in-compatible with `apps/signaling`'s pub-sub semantics.

### 1.1 User-Visible Regressions

After v1.1 ships, retro/conf will refuse anonymous users. Sharing a room
link with a person who is not signed in to a Google account will fail.
The sign-in UI is delivered as part of the v1.1 frontend migration —
until then, the server-side change is invisible to end users because the
existing `apps/signaling` continues to serve the legacy anonymous path.

---

## 2. Confirmed Requirements (from user spec)

**App:** `apps/communication/` — new Node.js Socket.IO relay server inside the monorepo.

**Stack:**
- Fastify 5.x as the HTTP host (health/admin endpoints + plugin ecosystem).
- Socket.IO 4.x bolted onto `fastify.server` (the underlying `http.Server`).
- TypeScript strict mode, ES Modules, Biome, Vitest 4 — identical conventions
  to `apps/portfolio` and `apps/signaling`.
- pnpm workspace + Moon target, mirroring `apps/signaling/moon.yml`.
- `zod` is the **repository-wide standard** for schema validation, picked here
  for the first time and intended for all future validation work in this repo
  (see §10.1).
- `jose` for JWT verification + JWKS retrieval (pure-JS, zero native deps).
- `node-config` (npm package `config`) + TOML files for layered
  configuration; `custom-environment-variables.json` for env-var overrides.
  See §4 and §8 — this is the only seam through which secrets / per-host
  values reach the running process. zod validates the merged config into
  a typed `IServerConfig`.

**Authentication (Google OpenID Connect):**
- Client obtains a Google ID Token in the browser via OIDC (out of scope for
  this server).
- Client passes `{ roomId, idToken, displayName }` in the Socket.IO handshake
  `auth` payload.
- Server middleware validates the ID token at handshake:
  - Signature against Google's JWKS (`https://www.googleapis.com/oauth2/v3/certs`),
    cached by `jose`.
  - `iss` ∈ {`https://accounts.google.com`, `accounts.google.com`}.
  - `aud` === `GOOGLE_OAUTH_CLIENT_ID` env var.
  - `exp` in the future, with explicit `clockTolerance` of
    `config.auth.clock_tolerance_seconds` (default 5 s; jose's default
    is 0).
  - `algorithms: ['RS256']` only — defeats `none` / HS256-with-public-key
    / algorithm-confusion attacks.
- On failure → connection rejected with a typed `AuthErrorCode`.
- On success → `Identity = { userId, displayName }` attached to
  `socket.data`, where `userId` is the JWT `sub` and `displayName ←
  claims.name` (the JWT `name` claim is REQUIRED). **If `name` is absent,
  the handshake is rejected with `auth/missing-name-claim`.** The server
  does NOT cascade to `email` — see §13.1 supersedes note.
- **Token-expiry lifecycle:** per-connection scheduler. At
  `exp − TOKEN_EXPIRY_WARNING_SECONDS` (default 60), emit `auth:token-expiring`.
  At `exp`, emit `auth:token-expired` and disconnect with reason `auth/expired`.
- **Token refresh:** client may send `auth:refresh-token` with `{ idToken }`.
  Server re-validates and replaces stored claims; on failure the ack carries an
  `AuthErrorCode` but the connection is **not** dropped (the previous token may
  still be valid).

**Protocol — Socket.IO mapping:**
- **Endpoint pattern:** clients connect to the **root namespace**. The room id
  (UUID) plus auth credentials travel in the handshake `auth` field. The server
  validates everything, calls `socket.join(roomId)` only on success. (Option A —
  see §3 for justification vs. dynamic namespaces.)
- **Initiator** emits `command:initiate` with payload
  `{ command: string, payload: unknown, correlationId: string }`, **with ack**.
- **Server ack** to the initiator (synchronous reply on the dispatch event):
  `{ socketCount: number, users: Array<{ userId, displayName }>, correlationId: string }` —
  count *includes* the initiator. (See §6 for why "includes initiator" is the
  chosen semantic.)
- **Server fanout (manual per-responder, NOT `socket.to(room).emitWithAck`):**
  the server snapshots the room's responder sockets via
  `io.in(roomId).fetchSockets()` (excluding the initiator), then issues
  `responderSocket.timeout(10_000).emitWithAck('command:execute', request)` in
  parallel for each responder. Each ack is forwarded individually as it
  settles. Payload carries `initiator: { userId, displayName }` so responders
  can render "Alice is asking…". (See §7.2 `ICommandTransport`/`SocketIORoomTransport`
  for the rationale: `socket.to(room).timeout(t).emitWithAck()` returns a
  single batched array of acks — incompatible with per-responder streaming.)
- **Each responder** receives `command:execute` and returns its ack:
  `{ payload: unknown, correlationId: string }`.
- **Server forwarding:** as each responder ack settles (resolved or timed-out),
  the server emits `command:response` back to the initiator carrying
  `{ payload, correlationId, responder, kind }`. **No batching.** Replies
  stream as they arrive. The `responder: { userId, displayName }` field is
  included for `kind: 'ok' | 'timeout' | 'responder-disconnected'` so the
  initiator UI can render "Bob timed out".
- **Room presence:** on every `connection` and `disconnect` to a room, the
  server emits `room:presence` to all clients in the room with
  `{ socketCount: number, users: Array<{ userId, displayName }> }`.

**Limits (configurable via env, defaults locked):**
- `maxHttpBufferSize`: 1 MB (Socket.IO default).
- Max clients per room: **50** — refuse the connection when a 51st joins.
- Response gather timeout: **10 000 ms** per responder.
- Token-expiry warning lead time: **60 s** before `exp`.
- HTTP long-polling fallback: enabled (Socket.IO default).

**Deployment:** local `pnpm dev` (live reload via `node --watch
--experimental-strip-types`, matching `apps/signaling`) plus a portable
multi-stage Dockerfile.

**Build wiring:** root `pnpm build` will include `apps/communication`
(confirmed by user; see §8 and §14).

**Client OAuth scope requirement (Q8).** The browser-side OpenID Connect
flow MUST request the scopes `openid profile email` when obtaining the
ID token. Without `profile` the JWT will not carry a `name` claim, which
is REQUIRED to derive `displayName`; if `name` is absent, the server
rejects the handshake with `auth/missing-name-claim`. The `email` scope
is reserved for future features and is NOT used to derive `displayName`
in v1 — broadcasting an email address to every other room participant
would leak user identity, so we explicitly reject that fallback (see
§13.1 supersedes note). This is the client's responsibility — the server
does not negotiate scopes. The requirement is repeated in
`apps/communication/README.md` so client integrators see it without
having to read this design document.

### 2.9 Signaling Protocol (replaces apps/signaling)

The new server takes over the role of `apps/signaling`. The semantics are
**identical**: a topic-scoped pub/sub where clients publish opaque blobs
(WebRTC SDP offers/answers, ICE candidates) and other subscribers
receive them. The differences from the legacy server are:

- **Transport.** Socket.IO 4 over TLS instead of plain `ws`.
- **Authentication.** Every signaling message rides an OIDC-authenticated
  socket. Anonymous signaling (the legacy default) is **removed**. Retro
  and Conf users must sign in with Google. **UX regression accepted and
  documented** — there is no longer an anonymous-share-the-link path.
- **Topic == Room.** The legacy server had a free-form `topic` string;
  the new server reuses `roomId` (UUID) as the broadcast scope. "Topic"
  and "room" are the same concept. A user wanting to subscribe to N
  rooms opens N parallel socket connections — we deliberately do NOT
  add multi-room-per-socket because that would diverge from the existing
  per-socket `roomId` model and complicate auth/rate-limit accounting.
- **Events.**
  - Client → server: `signal:publish` with `{ payload: unknown,
    correlationId?: string }` (ack-shape). `payload` is opaque; the
    server does not parse or validate its contents.
  - Server → others: `signal:event` with `{ payload, from: { userId,
    displayName }, correlationId? }`. The server adds the `from` field
    so subscribers can identify the publisher.
- **Server is opaque.** No SDP parsing, no codec inspection, no ICE
  candidate filtering. Matches `apps/signaling` exactly.
- **Same exclusion rule as commands.** The publisher does not receive
  its own `signal:event` echo.

### 2.10 TURN/STUN

- `coturn` is deployed on the same VM as the Communication server.
- Listeners:
  - `:3478 udp` and `:3478 tcp` — STUN + plain TURN.
  - `:5349 tcp` — TURN over TLS (TURNS), behind HAProxy SNI passthrough.
- Authentication: `--use-auth-secret` (RFC 7635-style HMAC-SHA1). No
  long-term credentials are ever provisioned in `coturn`'s database.
- Credential issuance: Communication issues short-lived creds via the
  authenticated Socket.IO event `turn:request-credentials`. TTL default
  is 12 hours, bounded `[60 s, 24 h]` (M4 — bumped from 1 h to reduce
  refresh churn during long calls).
- The shared HMAC secret is stored in `/etc/communication/turn-secret`
  on the host (chmod 600, owner = communication user) and exposed to
  both processes via env (`TURN_SHARED_SECRET` for Node; `coturn` reads
  it via `static-auth-secret` in `turnserver.conf`).

### 2.11 Edge networking

- HAProxy listens on `:443` in **TCP mode with SNI passthrough**.
  - SNI matching `<IP>.sslip.io` → backend `127.0.0.1:8443` (Fastify,
    which terminates TLS itself).
  - SNI matching `turn-<IP>.sslip.io` → backend `127.0.0.1:5349`
    (coturn TLS, which terminates TLS itself).
  - HAProxy never terminates TLS — it is L4. This keeps the trust
    boundary simple: each backend owns its own cert use.
- Both hostnames are covered by **one** Let's Encrypt SAN cert obtained
  via `certbot certonly --standalone -d <IP>.sslip.io -d
  turn-<IP>.sslip.io --cert-name communication`. Renewal hooks reload
  HAProxy and coturn and signal Fastify.
- `:3478 udp/tcp` stays direct on coturn — UDP cannot share a port with
  HAProxy and there is no TLS to route.

---

## 3. Similar Protocols — Why Socket.IO

We considered three off-the-shelf request/response RPC patterns over WebSocket
before locking the choice:

| Protocol | Strengths | Why we are not picking it |
|---|---|---|
| **Plain `ws` + custom JSON** (mirror of `apps/signaling`) | Zero deps; tiny footprint; trivial to reason about. | Forces us to hand-roll: ack/correlation, room registry, presence events, response timeouts, transport upgrade, reconnection back-off. Every one of those is a re-implementation of Socket.IO's well-tested behaviour. |
| **WAMP (Crossbar / Autobahn)** | First-class RPC + pub/sub, formal spec, cross-language. | Heavy: Crossbar is a router daemon, not a library. Browser story is weak in 2026. Overkill for two-party room routing. |
| **Phoenix Channels** | Battle-tested, presence built-in. | Tied to Elixir / Phoenix. Adopting it just for this feature is a non-starter. |
| **Socket.IO 4** *(chosen)* | Acks with `emitWithAck`; rooms as a primitive; presence via `connection`/`disconnect`; managed reconnect; transport upgrade (polling -> WS) for free; mature TypeScript types; first-class handshake middleware (`io.use`) which is exactly where our auth check belongs. | Adds ~120 KB on the server side and ~25 KB gzipped on the client (acceptable — only the comm feature pulls it in). |

**Namespace choice — Option A (root namespace + handshake `auth` payload)**
over Option B (dynamic namespaces `/room/:uuid`):

| Concern | Option A (root + `socket.join(roomId)`) | Option B (dynamic ns `/room/:id`) |
|---|---|---|
| Memory per room | One `Set<SocketId>` entry in `Adapter.rooms`. | Full `Namespace` instance per room — includes its own listener registry and adapter. ~10x heavier per room. |
| Cleanup | Automatic when last socket leaves. | Manual: namespaces are kept alive by the server until explicitly removed (`ParentNamespace` tricks). |
| Auth hook | Single `io.use(authMiddleware)` covers everything — exactly one place to wire the OIDC verification. | Must register middleware on each generated child namespace. |
| Room ergonomics | `socket.to(roomId).emit(...)` and `io.in(roomId).fetchSockets()` are first-class. | Must scope every API call to the right namespace. |
| Listener count | `io.sockets.adapter.rooms.get(roomId)?.size`. | `nsp.sockets.size`. Roughly equivalent. |

**Decision:** Option A. The only argument for B is hard isolation (sockets in
different namespaces cannot hear each other even with bugs). We get the same
guarantee with Option A by always using `socket.to(roomId).emit(...)` instead
of `io.emit(...)`, gated by a single domain-layer test ensuring no global
broadcast helper is exposed. Option B's overhead per room is not justified.

---

## 4. Research Summary

**Files read in full:**
- `/Users/dmitry.sharov/Documents/own-projects/home-projects/CLAUDE.md` — all
  conventions: DDD layout, Biome rules, no-barrel-files, `assert` over `!`,
  `lodash-es` over manual, Temporal over Date, no magic numbers.
- `/Users/dmitry.sharov/Documents/own-projects/home-projects/package.json` —
  root deps. Confirmed: `ws@8.18`, `lodash-es`, no fastify, no socket.io, no
  schema validation library anywhere in the monorepo.
- `/Users/dmitry.sharov/Documents/own-projects/home-projects/pnpm-workspace.yaml`
  — `apps/**/*` and `libs/**/*` are workspaces.
- `/Users/dmitry.sharov/Documents/own-projects/home-projects/biome.json` —
  rules to satisfy. Already includes a per-folder override
  `apps/signaling/src/**` that turns off `noConsole`. We will mirror that for
  `apps/communication/src/**`.
- `/Users/dmitry.sharov/Documents/own-projects/home-projects/tsconfig.base.json`
  — base; not used by app tsconfigs (they extend `@frozik/typescript-config`).
- `/Users/dmitry.sharov/Documents/own-projects/home-projects/.moon/toolchains.yml`
  — Node `22`, pnpm `10.14.0`. Both Fastify 5 and Socket.IO 4 require Node
  >= 18 with native ESM, so 22 is fine. `jose@5` requires Node >= 18.
- `/Users/dmitry.sharov/Documents/own-projects/home-projects/.moon/workspace.yml`
  — projects glob.
- `/Users/dmitry.sharov/Documents/own-projects/home-projects/.moon/tasks/tag-application.yml`
  — applies common build inputs to all `tag: application` projects.
- `/Users/dmitry.sharov/Documents/own-projects/home-projects/moon.yml` —
  root tasks: `lint`, `format`, `test`, `build`, `deploy`, `madge`,
  `type-check`. The build task currently runs `moon run portfolio:build` —
  see §8 and §14 (decision: extend `pnpm build` to include
  `@frozik/communication:build`).
- `/Users/dmitry.sharov/Documents/own-projects/home-projects/vitest.config.ts`
  — root vitest with `environment: 'happy-dom'`. We will override at the file
  level with `// @vitest-environment node` directives instead of adding a
  second config (keeps one source of truth).
- `/Users/dmitry.sharov/Documents/own-projects/home-projects/apps/signaling/**` —
  **the most important reference.** This is an existing Node WS server in
  the same monorepo: pure ESM, `node --watch --experimental-strip-types`
  for dev, `tsc -p tsconfig.build.json` for build, `node dist/server.js`
  for prod. Its `package.json` has zero runtime deps locally — `ws` is
  pulled from the hoisted root. We will follow the same pattern.
- `/Users/dmitry.sharov/Documents/own-projects/home-projects/apps/signaling/scripts/install.sh`
  — VPS installer. We will not duplicate it; the Dockerfile is the
  per-PaaS deployment surface for communication.
- `/Users/dmitry.sharov/Documents/own-projects/home-projects/libs/typescript-config/tsconfig.node.json`
  — strict, ESNext, bundler resolution, `noEmit: true` (turned off in
  `tsconfig.build.json` overrides).
- `/Users/dmitry.sharov/Documents/own-projects/home-projects/libs/utils/src/assert/assert.ts`,
  `assertNever.ts`, `parseJson.ts`, `types/base.ts`, `date/types.ts` —
  reusable utilities.

**Reusable from `@frozik/utils`:**
- `@frozik/utils/assert/assert` — narrow nullable types (replaces `!`).
- `@frozik/utils/assert/assertNever` — exhaustive switch on the
  `command:*` event union and the `AuthErrorCode` union.
- `@frozik/utils/types/base` — `Opaque<T, U>` for branding `RoomId` (UUID),
  `SocketId`, `CorrelationId`, `UserId`, `DisplayName`.
- `@frozik/utils/date/types` — `Milliseconds` opaque type for the timeout
  constants and `exp` deltas.
- `@frozik/utils/parseJson` — only if we end up parsing arbitrary JSON
  outside Socket.IO's parser; in practice Socket.IO does it for us.
- `lodash-es/isNil` — null/undefined guards.

**What is net-new (the only items added to this monorepo):**
- `apps/communication/` — directory and source.
- Nine runtime deps in root `package.json` (latest stable major at install
  time — versions are intentionally NOT pinned in this plan and will be
  resolved by `pnpm add` when implementation begins): `fastify`,
  `socket.io`, `zod` (the repo-wide standard for schema validation, see
  §10.1), `jose` (JWT + JWKS for OIDC, see §6 and §12), `config` (the
  npm name for `node-config` — layered TOML configuration, see §4.1 and
  §8), `toml` (peer dependency `node-config` uses to parse TOML files),
  **`@fastify/rate-limit`** (handshake rate limiting, M11),
  **`prom-client`** (OpenMetrics exposition for `/metrics`, M17), and
  **`proxy-protocol-js`** (parses HAProxy PROXY protocol v2 to recover
  the original client IP for rate-limit accounting, C1).
  Plus three devDeps: `socket.io-client` for integration tests,
  `pino-pretty` (dev only), `@types/config` (TypeScript types for the
  `config` package).

### 4.1 `node-config` Selection Rationale

**Decision: `node-config` over a hand-rolled config loader.**

`node-config` is the dominant Node.js layered-configuration library
(over a decade in production, broad ecosystem familiarity). The user
has explicitly seen its `custom-environment-variables.json` env-var
mapping idiom in other projects and asked for it here — adopting the
library means we get the established pattern unchanged rather than
reinventing it. CLAUDE.md's *"Prefer established libraries over custom
code"* rule applies cleanly: the alternative is to hand-roll a TOML
parser plus a precedence ladder plus an env-var mapping format, which
is exactly the kind of custom code the rule warns against.

**Trade-offs (acknowledged honestly):**

- *Singleton API.* `node-config` exposes a process-global `config`
  object. Calling `config.get('foo')` from any module would couple the
  whole codebase to that singleton and make tests order-dependent.
  *Mitigation:* the package is imported in exactly one file —
  `infrastructure/load-config.ts`. That file calls
  `config.util.toObject()` once, runs the merged object through a zod
  schema, and returns a typed `IServerConfig`. Every other module
  receives `IServerConfig` (or just the values it needs) via constructor
  injection. The singleton is invisible past the seam.
- *Filesystem coupling at startup.* `node-config` reads files from
  `./config/` at module-load time. *Mitigation:* tests use a sibling
  factory `loadConfigFromObject(rawObject): IServerConfig` that runs
  the same zod schema against an in-memory object, bypassing the
  filesystem and the global. Production uses `loadConfig()` (the
  filesystem-driven entry point) called once at boot.
- *TOML peer dep.* `node-config` requires a separate `toml` package
  to parse TOML files; this is well-established and explicitly
  documented by `node-config`. We add `toml` as a runtime dep.
- *Env selector quirk.* `node-config` uses `NODE_CONFIG_ENV` (or
  `NODE_ENV` as fallback) to choose which environment file to merge.
  We deliberately set `NODE_CONFIG_ENV` (not `NODE_ENV`) in our
  Dockerfile and dev scripts so config-environment is decoupled from
  Node's own `NODE_ENV` (which Fastify and pino still consume for
  unrelated reasons). Documented in §8.5.

**Why TOML over JSON / YAML for the static layers:** TOML reads better
for sectioned, comment-rich config (which our keys are); JSON has no
comments; YAML's whitespace pitfalls outweigh its terseness. The
machine-readable env-mapping file is JSON because that is what
`node-config` expects (`custom-environment-variables.json`).

---

## 5. Architecture

### 5.1 Component Diagram (text)

```
                        +-------------------------------------+
   HTTP request  --->   |  Fastify (:PORT)                    |
                        |    GET /health   (JSON)             |
                        |    GET /metrics  (text/plain)       |
                        |    pino logger                      |
                        +------------+------------------------+
                                     |
                                     | fastify.server
                                     v
                        +-------------------------------------+
   WS upgrade   --->    |  Socket.IO Server (root namespace)  |
                        |    io.use(authHandshakeMiddleware)  |
                        |    io.on('connection', ...)         |
                        |    'auth:refresh-token' handler     |
                        +------+----------------------+-------+
                               |                      |
                               |    presentation/     |   <-- thin Socket.IO
                               |    socket-handlers   |       glue layer
                               v                      v
                  +----------------------------+  +-----------------------------+
                  | application/               |  | application/                |
                  | CommandRouter              |  | IRoomRegistry (port)        |
                  | PresenceBroadcaster        |  | ConnectionLifecycle         |
                  | TokenLifecycle             |  |   (onHandshake / onRefresh  |
                  | hashUserId                 |  |    / onDisconnect — M24)    |
                  | config/{IServerConfig,     |  |                             |
                  |   server-config-schema}    |  |                             |
                  +-------------+--------------+  +--------------+--------------+
                                |                                |
                                +----------------+---------------+
                                                 |
                                                 v
                  +-----------------------------------------------+
                  | application/ports/  (M18 — split)             |
                  |   ICommandTransport, IPresenceTransport,      |
                  |   ISignalTransport, ILifecycleTransport,      |
                  |   IServerLogger, IAuditLogger (M4),           |
                  |   IVerifierHealth (M16)                       |
                  +-----------------------------------------------+
                                                 |
                                                 v
                  +-----------------------------------------------+
                  | domain/                                       |
                  |   Identity, TokenClaims, AuthErrorCode        |
                  |   IIdentityVerifier (port)                    |
                  |   protocol types + zod validators             |
                  |   Room (pure aggregate, members w/Identity)   |
                  |   constants, errors                           |
                  +-----------------------------------------------+
                                                 ^
                                                 |
                  +-----------------------------------------------+
                  | infrastructure/                               |
                  |   GoogleIdentityVerifier (impls IIdentity-    |
                  |     Verifier + IVerifierHealth; jose + JWKS;  |
                  |     algorithms ['RS256'] — C4)                |
                  |   SocketIORoomTransport (impls all four        |
                  |     transport ports — M18; manual fanout — C1)|
                  |   PinoServerLogger (impls IServerLogger)      |
                  |   PinoAuditLogger (impls IAuditLogger — M4)   |
                  |   load-config.ts (TOML+env -> zod -> typed)   |
                  +-----------------------------------------------+
```

### 5.2 DDD Layering for a Server

We apply the same 4-layer DDD pattern the portfolio features use, adapted
to a server context (no React, no MobX). Import direction is identical:
`presentation -> application -> domain <- infrastructure`.

#### `domain/` — pure TypeScript, zero runtime deps beyond `@frozik/utils` + `zod`
- The protocol contract: event names, payload types, the responder ack shape.
- **Identity model:** `Identity`, `TokenClaims`, `UserId`, `DisplayName`,
  `AuthErrorCode`, plus the `IIdentityVerifier` port (a token verification
  abstraction; the `jose`-backed implementation lives in `infrastructure/`).
- **`Room`** aggregate: a tiny pure class that tracks listener identities
  (a `Map<SocketId, Identity>`) and enforces the 50-listener cap. **No
  Socket.IO, no Fastify, no `jose`** — it owns `SocketId`s as opaque strings
  and `Identity` records. 100% unit-testable.
- **`RoomRegistry` interface** (the port). Application uses it; an in-memory
  domain implementation is provided here because the registry is part of the
  domain model — it does not depend on any external system.
- Validators (zod schemas) for `command:initiate`, `command:execute` ack,
  handshake `auth`, `auth:refresh-token`, all auth events. Validators belong
  in domain because they encode business invariants (the contract), not
  infrastructure.
- **Protocol-level constants only:** event-name string literals
  (`COMMAND_INITIATE = 'command:initiate'`, etc.), error codes,
  `MAX_DISPLAY_NAME_LENGTH` (an invariant of the protocol), the
  Google issuer set, the JWKS URL. **Operational/tunable values
  (`MAX_LISTENERS_PER_ROOM`, `RESPONSE_GATHER_TIMEOUT_MS`,
  `MAX_HTTP_BUFFER_BYTES`, `DEFAULT_PORT`, `TOKEN_EXPIRY_WARNING_SECONDS`)
  are NOT compile-time constants any more — they live in TOML and
  flow through `IServerConfig`. See §7.2 entry for `constants.ts` and
  §8 for the new layered config layout.**

**Domain forbidden imports:** `socket.io`, `fastify`, `pino`, `jose`,
`node:net`, `node:http`. The verifier port is just a TS interface — the
`jose` dependency lives behind it in `infrastructure/`.

#### `application/` — use cases, orchestration, no I/O
- **`CommandRouter`**: orchestrates `initiate -> fanout -> per-response
  forward`. Depends on `ICommandTransport` (M18), `IRoomRegistry`, `IServerLogger`.
  Per-correlation per-responder state machine (C2); Identity snapshot
  at fanout start (C3); per-socket back-pressure (M8); orphan handling
  (M7).
- **`PresenceBroadcaster`**: on join/leave, computes the new member count
  and `users[]` (from each `Room`'s `Identity` map) and asks the transport
  to emit `room:presence`.
- **`ConnectionLifecycle`** (M24 — collapsed): exposes
  `onHandshake / onRefresh / onDisconnect`. Ties handshake validation,
  room admission (subject to `max_listeners` and `max_tabs_per_user`),
  lifecycle scheduling (`TokenLifecycle.arm`), refresh binding (M10),
  and disconnect cleanup.
- **`TokenLifecycle`**: per-connection scheduler. Uses `setTimeout` and
  `Temporal.Now.instant()` directly — no `IClock` / `IScheduler` (M23).
  Generation guard (M6) defends against stale callbacks after
  `replaceClaims`. Emits via callbacks (`onWarning`, `onExpired`), does
  NOT touch Socket.IO directly.
- **`hashUserId.ts`** (M12): pure `sha256(userId).slice(0,16)` helper.
- **`config/IServerConfig.ts`** + **`config/server-config-schema.ts`**
  (M25 — moved from `domain/`).
- **Result-vs-throw policy (M22).** Use cases and ports return
  `Result<T,E>` consistently. Throws are reserved for invariant
  violations (`assert(...)`), `ConfigValidationError` at boot, and
  unrecoverable startup errors.
- **No `import` from socket.io, jose, or fastify** anywhere in this layer.

#### `infrastructure/` — the only layer that imports `socket.io`, `fastify`, `pino`, `jose`
- **`SocketIORoomTransport`**: implements all four transport ports
  (`ICommandTransport`, `IPresenceTransport`, `ISignalTransport`,
  `ILifecycleTransport` — M18). Manual per-responder fanout (C1) —
  uses `io.in(roomId).fetchSockets()` + parallel
  `responderSocket.timeout(t).emitWithAck(...)`, NOT the batching
  `socket.to(room).emitWithAck` helper.
- **`InMemoryRoomRegistry`**: `Map<RoomId, Room>`-backed. (Could live in
  `domain/` since pure — kept here so we may swap to a Redis-backed adapter
  for multi-node later. The interface is in `domain/`.)
- **`PinoServerLogger`**: implements `IServerLogger`.
- **`PinoAuditLogger`** (M4): implements `IAuditLogger` via a separate
  pino channel.
- **`GoogleIdentityVerifier`**: implements `IIdentityVerifier` AND
  `IVerifierHealth`. Uses `jose.createRemoteJWKSet` + `jose.jwtVerify`
  with `algorithms: ['RS256']` (C4). Caches JWKS via `jose`'s built-in
  cache and records fetch outcomes for `/health/ready`. Maps `jose`
  errors to `AuthErrorCode`. `azp` audience check (M9).
- **`load-config.ts`**: the **only** file in the codebase that imports
  the `config` (`node-config`) package. Loads layered TOML +
  `custom-environment-variables.json` env-var overrides, validates
  through zod, returns a typed `IServerConfig`. Crashes the process on
  validation failure with a descriptive error listing every missing or
  invalid key, the source layer (M21), and the env var that overrides
  it. Exposes both `loadConfig()` (filesystem) and
  `loadConfigFromObject(raw)` (in-memory; for tests).

#### `presentation/` — Socket.IO + Fastify glue (a.k.a. the "interface" layer)
- **`bootstrap.ts`**: creates the Fastify app, registers
  `@fastify/rate-limit` on the upgrade route (M11), registers HTTP
  routes (`/health/live`, `/health/ready`, `/metrics`,
  `/admin/log-level` on a separate admin port — m6), attaches
  Socket.IO `Server` to `fastify.server`, wires
  `ConnectionLifecycle.{onHandshake,onRefresh,onDisconnect}` to
  socket events. Implements two-phase shutdown (M18). **Receives the
  typed `IServerConfig` produced by `load-config.ts` and injects only
  the values each collaborator needs into its constructor — never
  passes the full config object into domain or application layers.**
- **`socket-handlers.ts`**: the `io.on('connection', socket => ...)`
  callback — kept very thin. Each handler immediately delegates to
  `ConnectionLifecycle` / `CommandRouter`. Wires `TokenLifecycle`
  callbacks to emit `auth:token-expiring` / `auth:token-expired` and
  disconnect.
- **`http-routes.ts`**: `GET /health/live`, `GET /health/ready` (M16),
  `GET /metrics` (M17 — OpenMetrics text), `POST /admin/log-level` on
  the admin port (m6).

### 5.3 Module Boundaries (what each layer must NOT import)

| Layer | Forbidden imports |
|---|---|
| domain | `socket.io`, `socket.io-client`, `fastify`, `pino`, `jose`, `node:net`, `node:http`, `zod` (m12 — domain types are pure; schemas live in `protocol-validators.ts`), `socket.io`, `node-config`, anything from `presentation/` or `infrastructure/`. |
| application | `socket.io`, `socket.io-client`, `fastify`, `pino`, `jose`, `node-config`, `node:fs`, `node:net`. May import only `domain/`, `application/ports/`, `node:crypto` and `node:timers` directly when the call is deterministic given inputs OR tests can control it via `vi.useFakeTimers()` / fixture inputs (m11). May import `Temporal` directly. |
| infrastructure | `application/`, `presentation/`. May import `domain/` + external libs (`jose`, `socket.io`, `pino`, …). |
| presentation | infrastructure/ types via interfaces only — never reaches into infra internals. |

**Application Node-stdlib rule (m11).** `application/` MAY import
Node stdlib modules (`node:crypto` for HMAC, `node:timers` for
`setTimeout`/`clearTimeout`) and `Temporal` directly because they are
deterministic given inputs (`crypto`) or controllable in tests
(`vi.useFakeTimers()` for timers, `vi.setSystemTime()` for `Temporal`).
It MUST NOT import `socket.io`, `fastify`, `jose`, `node-config`,
`node:fs`, `node:net`. The forbidden list ensures the layer stays
side-effect-free at module load.

Enforcement: `madge --circular` and Biome's `noBarrelFile`. A domain-level
test imports the `domain/` and `application/` trees and asserts no
transitive `socket.io`, `jose`, or `fastify` symbols leak in.

---

## 6. Protocol Specification

### 6.1 Event Catalogue

All event names use `subject:verb` with a colon separator (Socket.IO
idiomatic). All payloads are plain JSON. All ack callbacks are typed.

| Direction | Event | Payload | Ack |
|---|---|---|---|
| **Handshake** | `auth` (Socket.IO `auth` payload) | `IHandshakeAuth` | n/a — handled by `io.use` middleware. Failure surfaces as `connect_error`. |
| **C -> S** | `command:initiate` | `IInitiatePayload` | `IInitiateAck` |
| **C -> S** | `auth:refresh-token` | `IAuthRefreshTokenPayload` | `IAuthRefreshTokenAck` |
| **S -> C** | `command:execute` | `IRequestPayload` | `IExecuteAck` |
| **S -> C** | `command:response` | `IResponsePayload` | (none — fire and forget) |
| **S -> C** | `room:presence` | `IRoomPresenceEvent` | (none) |
| **S -> C** | `auth:token-expiring` | `IAuthTokenExpiringEvent` | (none) |
| **S -> C** | `auth:token-expired` | `IAuthTokenExpiredEvent` | (none — disconnect follows) |
| **S -> C** | `server:draining` | `IServerDrainingEvent` (empty `{}`) | (none — clients reconnect to a different instance) |
| **S -> C** | `connect_error` (Socket.IO built-in) | `Error` with `data.code: AuthErrorCode \| RoomErrorCode` | (handled by client) |

### 6.2 Payload Types (TypeScript sketches — final home: `domain/protocol.ts`)

```ts
import type { Opaque } from '@frozik/utils/types/base';
import type { Milliseconds } from '@frozik/utils/date/types';

export type RoomId = Opaque<'RoomId', string>;          // validated UUID v4 (branded — M27)
// m12 — Opaque brands kept ONLY on the three identity-bearing types.
// CorrelationId, CommandName, SocketId, IsoDateTime are plain strings —
// the brand was overhead with no callers cross-checking.
export type SocketId = string;          // socket.io socket id
export type CorrelationId = string;
export type CommandName = string;
export type UserId = Opaque<'UserId', string>;          // userId (backed by JWT 'sub' internally; m12 keeps brand)
export type DisplayName = Opaque<'DisplayName', string>;// 1..50 chars
export type IsoDateTime = string;       // RFC 3339 / ISO 8601

export interface Identity {
  readonly userId: UserId;
  readonly displayName: DisplayName;
}

export interface TokenClaims {
  readonly sub: UserId;
  readonly exp: Milliseconds;        // absolute expiry in ms since epoch
  readonly iss: string;
  readonly aud: string;
}

export type AuthErrorCode =
  | 'auth/invalid-token'
  | 'auth/expired-token'
  | 'auth/wrong-audience'
  | 'auth/wrong-issuer'
  | 'auth/missing-fields'
  | 'auth/jwks-unreachable'
  | 'auth/missing-name-claim'
  | 'auth/sub-mismatch'        // refresh: new sub != existing sub (M10)
  | 'auth/rate-limited';       // upgrade refused by @fastify/rate-limit OR per-IP failed-handshake block (M11)

// Handshake
export interface IHandshakeAuth {
  readonly roomId: string;            // raw — server validates UUID v4
  readonly idToken: string;           // Google ID token (JWT)
  readonly displayName: string;       // raw — server validates 1..50 chars
}

// command:initiate (initiator -> server)
export interface IInitiatePayload {
  readonly command: CommandName;
  readonly payload: unknown;
  readonly correlationId: CorrelationId;
}
export interface IInitiateAck {
  readonly socketCount: number;   // includes initiator (see §6.4)
  readonly users: ReadonlyArray<Identity>;
  readonly correlationId: CorrelationId;
}

// command:execute (server -> responder)
export interface IRequestPayload {
  readonly command: CommandName;
  readonly payload: unknown;
  readonly correlationId: CorrelationId;
  readonly initiator: Identity;
}
export interface IExecuteAck {
  readonly payload: unknown;
  readonly correlationId: CorrelationId;
}

// command:response (server -> initiator) — discriminated union
export type IResponsePayload =
  | {
      readonly kind: 'ok';
      readonly payload: unknown;
      readonly correlationId: CorrelationId;
      readonly responder: Identity;
    }
  | {
      readonly kind: 'timeout';
      readonly correlationId: CorrelationId;
      readonly timedOutAfterMs: Milliseconds;
      readonly responder: Identity;
    }
  | {
      readonly kind: 'responder-disconnected';
      readonly correlationId: CorrelationId;
      readonly responder: Identity;
    }
  | {
      // M8 — back-pressure: too many in-flight initiates from this socket.
      readonly kind: 'dispatch-rejected';
      readonly reason: 'too-many-in-flight';
      readonly correlationId: CorrelationId;
    };

// server:draining (server -> all clients in all rooms; M18)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IServerDrainingEvent {}
// Zod: z.object({}).strict() — no fields; presence of the event is the signal.

// room:presence (server -> all)
export interface IRoomPresenceEvent {
  readonly socketCount: number;
  readonly users: ReadonlyArray<Identity>;
}

// auth:token-expiring (server -> single client)
export interface IAuthTokenExpiringEvent {
  readonly expiresAt: IsoDateTime;
  readonly secondsRemaining: number;
}

// auth:token-expired (server -> single client; disconnect follows)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IAuthTokenExpiredEvent {}

// auth:refresh-token (client -> server)
export interface IAuthRefreshTokenPayload {
  readonly idToken: string;
}
export type IAuthRefreshTokenAck =
  | { readonly ok: true; readonly expiresAt: IsoDateTime }
  | { readonly ok: false; readonly error: AuthErrorCode };
```

**Why `IResponsePayload` is a discriminated union:** §10 covers
responder-timeout policy. We *do* surface partial / timeout markers to the
initiator instead of silently dropping them. The discriminant is `kind`; the
client switches on it with `assertNever`.

**Zod schemas (`domain/protocol-validators.ts`)** mirror every shape above.
Examples:

```ts
import { z } from 'zod';

export const HandshakeAuthSchema = z.object({
  roomId: z.string().uuid(),
  idToken: z.string().min(1),
  displayName: z.string().min(1).max(MAX_DISPLAY_NAME_LENGTH),
});
export type ParsedHandshakeAuth = z.infer<typeof HandshakeAuthSchema>;

export const RefreshTokenPayloadSchema = z.object({ idToken: z.string().min(1) });

export const InitiatePayloadSchema = z.object({
  command: z.string().min(1),
  payload: z.unknown(),
  correlationId: z.string().min(1),
});
// ... and so on for IExecuteAck, IResponsePayload, IRoomPresenceEvent,
// IAuthTokenExpiringEvent, IAuthRefreshTokenAck.
```

The schemas live in `domain/protocol-validators.ts` and are exported as named
constants — never as a default barrel.

### 6.3 Sequence Diagrams

#### 6.3.1 Handshake — Success

```
Initiator                                           Server                                 Google JWKS
   |                                                  |                                          |
   | -- WS connect (auth: { roomId, idToken,          |                                          |
   |                          displayName }) -------->|                                          |
   |                                                  | io.use(authHandshakeMiddleware)          |
   |                                                  |   parseHandshakeAuth (zod)               |
   |                                                  |   verifier.verify(idToken) ------------->|
   |                                                  |                                          |
   |                                                  | <-- JWKS (cached by jose) -------------- |
   |                                                  |   jose.jwtVerify (sig, iss, aud, exp)    |
   |                                                  |   build Identity { userId, displayName } |
   |                                                  |   assertNotFull(roomId)                  |
   |                                                  |   socket.data = { identity, claims }     |
   |                                                  |   socket.join(roomId)                    |
   |                                                  |   tokenLifecycle.arm(claims, callbacks)  |
   |                                                  |   presenceBroadcaster.onJoin(roomId)     |
   | <-- (handshake ok) ----------------------------- |                                          |
   | <-- 'room:presence' { socketCount, users }--|                                          |
```

#### 6.3.2 Handshake — Failure

```
Initiator                                           Server
   |                                                  |
   | -- WS connect (auth: { roomId, idToken (bad),    |
   |                          displayName }) -------->|
   |                                                  | parseHandshakeAuth (zod) ok
   |                                                  | verifier.verify(idToken)
   |                                                  |   -> Result.err('auth/invalid-token')
   |                                                  | next(new InvalidTokenError({
   |                                                  |     code: 'auth/invalid-token' }))
   | <-- 'connect_error' { data: { code:              |
   |       'auth/invalid-token' } } ----------------- |
   |                                                  |
```

The middleware never calls `socket.join`; no `room:presence` is emitted; no
`TokenLifecycle` is armed. Failure codes per §6.5.

#### 6.3.3 Token expiring + refresh success

```
Client                                              Server
  |                                                   | (clock reaches exp - 60s)
  |                                                   | scheduler fires onWarning callback
  | <-- 'auth:token-expiring' { expiresAt,            |
  |       secondsRemaining: 60 } -------------------- |
  | (client fetches a new ID token)                   |
  | -- 'auth:refresh-token' { idToken } ------------->|
  |                                                   | ConnectionLifecycle.onRefresh (M24)
  |                                                   |   verifier.verify(idToken) -> ok
  |                                                   |   tokenLifecycle.replaceClaims(newClaims)
  |                                                   |   (warning + expiry timers re-armed)
  | <-- ack { ok: true, expiresAt } ----------------- |
```

#### 6.3.4 Token expired (no refresh)

```
Client                                              Server
  |                                                   | (clock reaches exp - 60s)
  | <-- 'auth:token-expiring' --------------------- - |
  | (no refresh sent)                                 |
  |                                                   | (clock reaches exp)
  |                                                   | scheduler fires onExpired callback
  | <-- 'auth:token-expired' {} -------------------- |
  |                                                   | socket.disconnect(true) reason 'auth/expired'
  | <-- WS close ----------------------------------- |
  |                                                   | presenceBroadcaster.onLeave(roomId)
  |                                                   | -> 'room:presence' to others
```

#### 6.3.5 Happy-path command (post-handshake)

```
Initiator                       Server                          R1            R2
   |                              |                              |             |
   | -- 'command:initiate'  ----->|                              |             |
   |     { cmd, payload, corrId } |                              |             |
   | <-- ack { socketCount,   |                              |             |
   |          users, corrId } --- |                              |             |
   |                              | -- 'command:execute' ack -->|             |
   |                              |     { cmd, payload, corrId,                |
   |                              |       initiator: {userId,displayName} }    |
   |                              | -- 'command:execute' ack ------>           |
   |                              |     timeout 10s on each                    |
   |                              | <-- ack { payload, corrId } -|             |
   | <- 'command:response' -------|     kind: 'ok',                            |
   |    { ok, payload, corrId,    |     responder: {userId,displayName}        |
   |      responder } -           |                                            |
   |                              | <-- ack { payload, corrId } -------------- |
   | <- 'command:response' -------|     kind: 'ok', responder                  |
```

### 6.4 Why `socketCount` Includes the Initiator

The user spec says "count includes initiator". That matches what the client
needs for UI: it wants to know "how many people are in this room *right
now*", not "how many people will receive my command". The latter is always
`socketCount - 1` — easy to derive client-side. Surfacing only the total
keeps `command:initiate` ack and `room:presence` event semantically
identical (both report room size + `users[]`), which simplifies client state.

### 6.5 Edge-Case Sequences

**(a) Responder times out** — Server emits
`command:response { kind: 'timeout', correlationId, timedOutAfterMs: 10000, responder }`
to initiator.

**(b) Responder disconnects mid-flight** — Socket.IO rejects the in-flight
ack promise. The router emits
`command:response { kind: 'responder-disconnected', correlationId, responder }`.

**(c) Initiator disconnects before responses arrive** — Per-correlation
`AbortController`; on disconnect, abort all pending forwards.

**(d) Room overflow (51st client)** — Middleware emits `connect_error` with
`data: { code: 'ROOM_FULL', maxListeners: 50 }`.

**(e) Auth failure codes** — Middleware emits `connect_error` with one of:
- `auth/invalid-token` (signature mismatch, malformed JWT, RS256
  algorithm mismatch, `iat` regression on refresh, `sid` mismatch on
  refresh).
- `auth/expired-token` (`exp` in the past).
- `auth/wrong-audience` (`aud !== GOOGLE_OAUTH_CLIENT_ID`, OR `azp`
  present and `azp !== GOOGLE_OAUTH_CLIENT_ID`).
- `auth/wrong-issuer` (`iss` not in the Google issuer set).
- `auth/missing-fields` (handshake `auth` failed zod parsing — empty
  `displayName`, missing `idToken`, etc.).
- `auth/jwks-unreachable` (`jose` could not fetch / refresh JWKS within its
  timeout). See §10 for trade-off discussion.
- `auth/missing-name-claim` (token validated but `name` claim absent —
  client did not request the `profile` scope; see §2 client OAuth scope
  requirement). **NOTE (M13): the server does NOT cascade to `email`. If
  `name` is absent, the handshake is rejected.**
- `auth/sub-mismatch` (refresh-only — new token's `sub` differs from the
  original; an in-place identity swap is not allowed).
- `auth/rate-limited` (M11 — handshake rejected by `@fastify/rate-limit`
  on the upgrade route OR by the application-level failed-handshake
  per-IP block).

**(f) Refresh with invalid token** — Server replies to the
`auth:refresh-token` ack with `{ ok: false, error: <AuthErrorCode> }`.
**Connection is NOT dropped** — the previously-validated token may still be
valid, and the refresh failure is a recoverable client-side condition (e.g.
they tried with a stale token from a different account).

**(g) `command:response` per-correlation per-responder state machine
(C2).** For each `(correlationId, responderSocketId)` pair, the server
maintains state `Pending → Settled(ok | timeout | disconnected)` with
EXACTLY ONE allowed transition. The first of `emitWithAck` resolution,
timeout signal, or disconnect signal wins; all later inputs for the same
pair are dropped silently at `debug` level. A late ack arriving after
the timeout has already been forwarded does NOT produce a second
`command:response`. See §9 for the test that pins this contract.

**(h) Per-correlation server-internal state keying (M3).** The router's
internal pending state is keyed on the tuple
`(correlationId, dispatchInstanceId)` where `dispatchInstanceId` is a
monotonic per-socket counter. The wire-level `correlationId` is
preserved unchanged across the whole flow. Two `command:initiate` events
with the same `correlationId` from the same socket are processed
independently — both ack, both fan out, both forward responses without
interference.

**(i) Multi-tab semantics — N tabs = N execute events (M5).** If the same
`userId` is connected via N tabs (N sockets) within the same room, a
single `command:initiate` from any other client produces N
`command:execute` events to that user (one per tab) and up to N
`command:response` events back to the initiator, all carrying the same
`responder.userId` (different `responder` Identity values may hold the
same `userId` but different rendered names / capabilities are not v1
concerns). **The server does NOT dedup by `responder.userId`.** Client
receivers MUST dedup `command:response` by `responder.userId` if they
want one-per-user semantics. §9 has a dedicated test pinning this
contract.

**(j) Join sequence (M4).** The handshake middleware completes
authentication, then in this exact order:
1. `socket.join(roomId)` (Socket.IO room membership).
2. `presenceBroadcaster.onJoin(roomId)` (re-emit `room:presence` to all
   members of the room — including the new socket).
3. Return from middleware.

The first event a freshly-connected client sees is `room:presence`. Any
`command:initiate` already in-flight at the moment the new socket joins
is NOT delivered to the late joiner — the in-flight broadcast uses the
identity snapshot captured at `command:initiate` arrival (C3).

**(k) Initiator dispatch back-pressure (M8).** A socket is allowed at
most `room.max_inflight_dispatches_per_socket` (default 32) outstanding
`command:initiate` correlations. The 33rd attempt is rejected with
`command:response { kind: 'dispatch-rejected', reason: 'too-many-in-flight', correlationId }`
delivered as the ack to the rejected `command:initiate`. No fanout
occurs. Counter decrements as correlations settle or the initiator
disconnects.

**(l) Server draining (M18).** On `SIGTERM`, the server first refuses
new WS upgrades, broadcasts `server:draining` (empty payload) to all
rooms so clients can reconnect to a different instance, and flips
`/health/ready` to 503. It then waits up to
`config.server.shutdown_grace_ms` (default 11_000) for in-flight
`command:initiate` correlations to settle, and finally calls `app.close()`.

### 6.Y Signaling Protocol (replaces apps/signaling)

The signaling protocol coexists with the command protocol on the same
authenticated Socket.IO connection. It is a thin pub/sub primitive that
matches the existing `apps/signaling` semantics (`subscribe` / `publish`
/ `unsubscribe`) — except `subscribe` and `unsubscribe` are implicit:
joining a room is "subscribing" and the only consumer of `signal:*` is
the room. There is no per-event subscription state machine.

#### 6.Y.1 Events

- **`signal:publish`** (client → server, **ack-shape**)
  - Wire payload: `{ payload: unknown, correlationId?: string }`.
  - `payload` is **opaque**. The server must not parse, mutate, or
    inspect it. Typical content (set by the client, not the server):
    a JSON-serialised WebRTC SDP offer / answer or an ICE candidate
    descriptor.
  - `correlationId` is optional. If provided, the server forwards it
    unchanged in the resulting `signal:event` so peers can use it for
    application-level threading. The server itself does not maintain
    per-correlation state for signaling.
  - Server behaviour: build `signal:event` = `{ payload, from: { userId,
    displayName }, correlationId }` and broadcast to **every other
    socket in the same room** (publisher excluded — same exclusion rule
    as `command:execute` fanout). No per-recipient ack collection — the
    server does not wait for delivery confirmation.
  - Ack to publisher: `{ ok: true, recipientCount: number }` where
    `recipientCount` excludes the publisher and counts every other
    socket in the room at the moment of broadcast — equivalent to
    `room.size - 1` (no per-user dedup; the field is kept so client UI
    can render "X people will see this") (m5). On rate-limit failure
    (see 6.Y.4), the ack is `{ ok: false, error: 'rate-limited' }` and
    no broadcast occurs. On the publisher being absent from any room
    (race with disconnect), the ack is `{ ok: false, error: 'not-in-room' }`
    (m2 — supersedes the earlier `'internal'` code for that case). On
    internal error: `{ ok: false, error: 'internal' }`. Oversize payload
    (`> [signal] max_payload_bytes`, default 16384) →
    `{ ok: false, error: 'payload-too-large' }`. Empty / null payload →
    `{ ok: false, error: 'invalid-payload' }`.

  `correlationId` on `signal:publish` is OPAQUE to the server — passed
  through unchanged. It does NOT enter the command state machine, does
  NOT count against `max_inflight_dispatches_per_socket`. Clients
  implement matching themselves (m3).

- **`signal:event`** (server → others)
  - Wire payload: `{ payload: unknown, from: { userId: string,
    displayName: string }, correlationId?: string }`.
  - Recipients distinguish messages by `from.userId`.

#### 6.Y.2 Multi-tab semantics

Each tab is a separate Socket.IO connection and therefore a separate
recipient. There is **no per-user dedup** — if Alice has three tabs in
the same room and Bob publishes, all three of Alice's tabs receive
`signal:event`. This is **different** from `command:execute`, which is
also per-socket but used by the application as a per-user RPC.
Signaling is genuinely per-socket pub/sub: a WebRTC peer connection is
per-tab, so Alice's three tabs are three independent peers.

The `from` field carries `{ userId, displayName, socketId }` (M3 —
adds `socketId`). `socketId` is a server-generated UUID stamped onto
`socket.data` at handshake (NOT Socket.IO's internal `socket.id`,
which is reused across reconnects). Same `userId` from two tabs are
distinguished by `socketId`; clients use `socketId` (and the server-
attached `from`) to filter self-echoes and to address per-peer state.

#### 6.Y intro: one Yjs doc per page (M2)

v1 ships with the constraint **one Yjs document per page**. A second
collaborative doc on the same page (e.g. a chat sidebar) requires a
second authenticated socket connection. The retro/conf v1.1 migration
assumes one doc per route. Lifting this restriction (multi-room-per-
socket) is a v2 deferred item (§13.2).

#### 6.Y.3 Sequence diagram (text)

```
Client A                Server                Clients B, C
   |                      |                       |
   |--signal:publish----->|                       |
   |  {payload, corr?}    |                       |
   |                      |--signal:event-------->|
   |                      |  {payload, from:A,    |
   |                      |   corr?}              |
   |<--ack {ok:true,------|                       |
   |   recipientCount:2}  |                       |
```

No timeouts, no per-correlation state machine. Signaling is fire-and-
forget pub/sub. The ack only tells A how many subscribers were present
to receive the event at the moment of broadcast.

#### 6.Y.4 Rate limiting

Signaling is **excluded from `room.max_inflight_dispatches_per_socket`**
(that cap exists for command-RPC fanouts). The signaling rate counter
is SEPARATE from `max_inflight_dispatches_per_socket` — they account
different traffic. Instead, a token-bucket per-socket rate limit
applies:

- `[signal] max_publish_per_second_per_socket = 100` (M1 — refill
  rate, default raised from 30 because Yjs awareness updates can
  burst much higher than ICE trickle alone).
- `[signal] max_publish_burst = 200` (M1 — token-bucket size).

Excess publishes are rejected with ack `{ ok: false, error:
'rate-limited' }`. The socket is **not** disconnected. On rate-limit,
the client SHOULD requeue with backoff; dropped ICE candidates do not
surface in `RTCPeerConnection` and silently degrade connectivity.

#### 6.Y.5 zod schemas

Schemas validate the **wrapper** only — the inner `payload` field is
left as `z.unknown()` because the server is opaque. The DTOs live in
`domain/protocol-validators.ts`.

- `SignalPublishPayloadSchema`: `{ payload: z.unknown().refine(v => v
  !== null && v !== undefined, { message: 'invalid-payload' }),
  correlationId: z.string().min(1).max(128).optional() }`. Wire size is
  enforced separately by the handler against
  `[signal] max_payload_bytes` (default 16384, m1).
- `SignalPublishAckSchema`: `z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), recipientCount: z.number().int().min(0) }),
  z.object({ ok: z.literal(false), error: z.enum(['rate-limited',
  'not-in-room', 'invalid-payload', 'payload-too-large', 'internal']) })
])` (m2 — added `not-in-room` for the missing-room race; `internal`
remains for true server faults).
- `SignalEventSchema`: `{ payload: z.unknown(), from: IdentitySchema
  extended with socketId: z.string().uuid(), correlationId:
  z.string().min(1).max(128).optional() }` (M3).

#### 6.Y.6 Migration of y-webrtc clients in v1.1 (C4)

**Wire-format incompatibility.** v1.1 retro/conf clients cannot use
stock `y-webrtc`'s `WebrtcProvider` with `signaling: ['wss://...']`
directly — y-webrtc expects raw `ws` and a `{ type: 'publish'|'subscribe',
topic, ... }` envelope, while this server speaks Socket.IO and the OIDC-
authenticated `signal:publish` / `signal:event` shape.

**Adapter approach.** Implement a custom `SignalingConn` adapter on the
client (lives in `apps/portfolio` once v1.1 lands) that wraps a
Socket.IO client with the OIDC handshake and translates wire formats:

- **Outbound translation.** When y-webrtc emits `{ type: 'publish',
  topic, ... }`, the adapter routes the message to the matching socket
  connection (one per topic) and emits
  `signal:publish { payload: <full y-webrtc message including topic> }`.
- **Inbound translation.** When the adapter receives
  `signal:event { payload, from }`, it surfaces the payload to
  `WebrtcProvider` as the original-format message (extracting from
  `payload`). `from.userId / from.displayName` are ignored for
  y-webrtc's internal routing — y-webrtc uses its own per-tab peer id
  carried in the payload — but `from.socketId` (M3) is used by the
  adapter to filter self-echoes that survive the same-room round trip.

**One topic = one socket.** If retro pages embed multiple Yjs documents
on the same page, each doc gets its own connection (consistent with
the M2 "one Yjs doc per page" v1 constraint; multi-doc pages are a v2
concern).

### 6.Z TURN Credentials

Authenticated clients can request short-lived TURN credentials over the
already-authenticated socket. The credentials are HMAC-SHA1-derived
(RFC 7635 / coturn `--use-auth-secret` static auth secret pattern) and
require no persistent state on the server.

#### 6.Z.1 Event

- **`turn:request-credentials`** (client → server, **ack-shape**)
  - Wire payload: none (empty object accepted; any extra fields are
    ignored).
  - **Server-side rate limit (M7):** maximum
    `[turn] credential_requests_per_minute_per_socket = 5` (default).
    Overflow returns ack `{ ok: false, error: 'rate-limited' }` and no
    creds are issued. Connection stays alive.
  - Server constructs the credential server-side from the configured
    shared secret + the authenticated `userId` + the current clock:
    - `nowSec = Math.floor(Temporal.Now.instant().epochMilliseconds / 1000)`.
    - `unixExpirySec = nowSec + config.turn.ttl_seconds` (m8 — renamed
      for clarity; per coturn `--use-auth-secret`, the leading integer
      in `username` is the **Unix timestamp at which the credential
      expires**, NOT a duration).
    - `userIdHash = sha256(userId).slice(0, 16)` — same hash used in
      logging redaction (see §11). Avoids embedding the raw `sub`
      claim into a value that is visible to every WebRTC peer.
    - `username = ${unixExpirySec}:${userIdHash}` (coturn parses the
      leading int as the expiry).
    - **HMAC argument order (M5).** Compute as
      `crypto.createHmac('sha1', sharedSecret).update(username).digest('base64')`.
      The secret is the first argument; the message (the username) is
      `update`'d. Concretely (Node sketch):
      ```ts
      import { createHmac } from 'node:crypto';
      const credential = createHmac('sha1', sharedSecret)
        .update(username)
        .digest('base64');
      ```
      The §9 unit test for `IssueTurnCredentialsUseCase` pins this
      against a hand-computed reference value.
    - `ttl = config.turn.ttl_seconds`.
    - `urls = config.turn.urls` — passed straight through from config
      to the client (typically — HAProxy mode —
      `["turns:turn-<IP>.sslip.io:443?transport=tcp",
      "turn:turn-<IP>.sslip.io:3478?transport=udp",
      "turn:turn-<IP>.sslip.io:3478?transport=tcp"]`; under
      `--no-haproxy`, the TURNS port is `5349` instead of `443`, M8).
  - Ack: `{ username: string, credential: string, ttl: number, urls:
    string[] }`. On rate-limit (M7): `{ ok: false, error:
    'rate-limited' }`. On internal error (HMAC computation failure,
    missing shared_secret in config — should never happen because
    config validation rejects empty secret in production): `{ ok:
    false, error: 'internal' }`. The success ack does **not** include
    `ok` — it is a flat object — to match RFC 7635's iceServers shape
    that callers will copy to `RTCPeerConnection`.

#### 6.Z.2 coturn validation

This shape is the contract `coturn` enforces on the receiving end:
when a TURN client authenticates with `username` + HMAC-derived
`password`, `coturn` (with `--use-auth-secret` and `static-auth-secret
= <same secret>`) computes the same HMAC and accepts iff:

1. `username` parses as `<int>:<opaque>`.
2. The HMAC over `username` matches the supplied `password`.
3. Current time < `parseInt(username.split(':')[0])`.

Therefore the server-issued credentials are immediately usable by
`coturn` with no extra coordination — the only shared state is the
HMAC secret on disk.

#### 6.Z.3 Authorization

This event is callable only on an already-authenticated socket. There
is no separate auth handshake. **No new `AuthErrorCode` values are
introduced.**

#### 6.Z.4 Sequence diagram (text)

```
Client A (wants WebRTC)         Server                   coturn
   |                               |                        |
   |--turn:request-credentials---->|                        |
   |   {}                          |                        |
   |                               |  HMAC-SHA1 over        |
   |                               |  "<exp>:<userIdHash>"  |
   |<--ack {username, credential,--|                        |
   |   ttl, urls}                  |                        |
   |                                                        |
   |---ALLOCATE (TURN) with username/credential------------>|
   |                                                        |
   |   coturn computes same HMAC, checks expiry, accepts    |
   |<--allocation------------------------------------------|
```

#### 6.Z.5 zod schemas

- `TurnCredentialsAckSchema`: `{ username: z.string().min(1),
  credential: z.string().min(1), ttl: z.number().int().min(60).max(86400),
  urls: z.array(z.string().min(1)).min(1) }` (M4 — max bumped to
  `86400` / 24h).

---

## 7. File-Level Plan

### 7.1 Tree After Implementation

```
apps/communication/
  Dockerfile
  README.md                                # how to run + ports + scopes + env
  moon.yml                                  # mirrors apps/signaling/moon.yml
  package.json                              # @frozik/communication
  server.md                                 # this document (kept for posterity)
  tsconfig.json                             # extends @frozik/typescript-config/node
  tsconfig.build.json                       # noEmit: false; outDir: dist
  config/                                   # node-config layered TOML config
    default.toml                            # base config (every key with safe default)
    development.toml                        # dev overrides (loose CORS, debug)
    production.toml                         # prod overrides (strict CORS, info)
    test.toml                               # test overrides (fast timeouts)
    custom-environment-variables.json       # env-var -> TOML key mapping
    # local.toml is gitignored (NOT committed; per-developer overrides)
  scripts/
    install.sh                              # orchestrator — runs locally on the operator's machine; rsync's lib/ to the target and invokes sub-scripts via ssh
    upgrade.sh                              # orchestrator — same model, upgrade flow
    docker-build.sh                         # convenience wrapper around `docker build`
    assert-server-deps-not-in-browser-bundle.ts   # m7 — fails build if server-only deps appear in apps/portfolio bundle
    lib/                                    # sub-scripts; idempotent; run ON the target via ssh
      common.sh                             # color/logging helpers (info/ok/warn/die), `set -euo pipefail`, error trap
      parse-args.sh                         # CLI arg parsing for orchestrators; missing required arg -> usage + exit 2
      remote-run.sh                         # ssh helper: rsync lib/, run a sub-script remotely with env
      ensure-system-packages.sh             # apt install nodejs, pnpm, haproxy, coturn, certbot, systemd-timesyncd, ufw
      ensure-system-user.sh                 # useradd communication; chown /opt/communication
      ensure-repo-clone.sh                  # git clone / pull into /opt/communication (sudo -u communication)
      build-app.sh                          # pnpm install --frozen-lockfile + pnpm --filter @frozik/communication build
      generate-turn-secret.sh               # openssl rand 32 -hex -> /etc/communication/turn-secret as KEY=VALUE for systemd EnvironmentFile (mode 0640, root:communication)
      render-toml-configs.sh                # render production.toml + custom-environment-variables.json (templates IP, urls, realm, --no-haproxy ports — M8)
      render-haproxy-cfg.sh                 # render /etc/haproxy/haproxy.cfg (-m str exact match, default_backend reject, send-proxy-v2 on backends, timeout tunnel 24h, timeout client/server 1h, timeout connect 5s) — M12, M13
      render-coturn-cfg.sh                  # render /etc/turnserver.conf (denied-peer-ip RFC1918+link-local+IPv6 ULA, no-tlsv1, no-tlsv1_1, cipher-list, dh-file, no-stun-backward-compatibility, no-stdout-log, verbose=0, log-file, fingerprint, no-multicast-peers, no-loopback-peers, no-cli, listening-ip=127.0.0.1 in HAProxy mode, total-quota=100, user-quota=4 — M7, max-bps configurable, realm=turn-<IP>.sslip.io, static-auth-secret=<bare hex sourced from turn-secret>) — M6, M7, M9, M10, M11, C3
      render-systemd-unit.sh                # render /etc/systemd/system/communication.service: EnvironmentFile=/etc/communication/turn-secret, LimitNOFILE=65536, Restart=always, RestartSec=5s, TimeoutStopSec=$((shutdown_grace_ms/1000+5))s; accept PROXY protocol on listening port (C1)
      render-renewal-hook.sh                # render /etc/letsencrypt/renewal-hooks/deploy/communication.sh: shebang + `set -eu` + reload haproxy + reload coturn + 2-phase restart of communication via systemctl kill -s SIGTERM + wait + systemctl start; NO `|| true` (M14, M15 — fail-fast)
      render-journald-conf.sh               # render /etc/systemd/journald.conf.d/communication.conf with SystemMaxUse=2G; also renders /etc/logrotate.d/coturn (rotate 3 daily compress) — M10
      render-cert-expiry-timer.sh           # render systemd timer running `openssl x509 -checkend $((7*86400)) -in fullchain.pem`; alerts journald-warn on failure — M15
      obtain-letsencrypt-cert.sh            # certbot certonly --standalone -d <IP>.sslip.io -d turn-<IP>.sslip.io --cert-name communication --email <CERT_EMAIL>; asserts port 80 is free; runs BEFORE enable-systemd-services; generates dh-file via openssl dhparam -out /etc/coturn/dhparam.pem 2048 (cached if exists) — M9
      configure-ufw.sh                      # mode-conditional firewall: HAProxy mode = allow 443/tcp + 3478/{udp,tcp} + 22/tcp, deny everything else; --no-haproxy mode = additionally allow 5349/tcp; temporarily allow 80/tcp for certbot, then revoke — C3
      enable-systemd-services.sh            # systemctl daemon-reload; enable --now coturn haproxy communication (in this order); curl-loop /health/live with timeout before declaring success
      pull-repo.sh                          # upgrade: git pull --ff-only with sudo -u communication
      install-deps.sh                       # upgrade: pnpm install --frozen-lockfile
      graceful-restart.sh                   # upgrade: 2-phase per M18 — systemctl kill -s SIGTERM communication; wait shutdown_grace_ms+5s; systemctl restart communication; verify /health/live
      smoke-test.sh                         # curl /health/live + curl /health/ready + verify systemctl is-active on all three services
  src/
    main.ts                                 # entry point — calls bootstrap(); two-phase SIGTERM (M18)
    domain/
      Room.ts                               # pure aggregate (members map: SocketId -> Identity)
      Room.test.ts
      IRoomRegistry.ts                      # interface (port) — file name follows primary export (M26)
      InMemoryRoomRegistry.ts               # the only implementation in v1
      InMemoryRoomRegistry.test.ts
      protocol.ts                           # event names + payload types (incl. auth:*, server:draining, signal:*, turn:*)
      protocol-validators.ts                # zod schemas for handshake, acks, auth/signal/turn events
      protocol-validators.test.ts
      constants.ts                          # protocol-level invariants only (no operational tunables)
      errors.ts                             # RoomFullError, InvalidTokenError, ConfigValidationError, etc.
      types.ts                              # Opaque types: RoomId, UserId, DisplayName (m12 — dropped on CorrelationId/CommandName/SocketId/IsoDateTime)
      Identity.ts                           # Identity, TokenClaims, AuthErrorCode types — types only, must NOT import zod, socket.io, fastify, node-config (m12). Schemas live in protocol-validators.ts.
      IIdentityVerifier.ts                  # port (interface) for token verification
      Signal.ts                             # SignalEvent, SignalPublishPayload, SignalAck types — types only, must NOT import zod, socket.io, fastify, node-config (m12). Schemas live in protocol-validators.ts.
    application/
      config/
        IServerConfig.ts                    # typed shape (M25 — moved from domain/)
        server-config-schema.ts             # composes section schemas; exports ServerConfigSchema + parseServerConfig + production-CORS refine (M25, m8)
        sections/                           # m14 — one zod object schema per [section]
          server-section.ts                 # [server], [server.tls]
          auth-section.ts                   # [auth], [auth.jwks]
          room-section.ts                   # [room]
          signal-section.ts                 # [signal]
          turn-section.ts                   # [turn]
          edge-section.ts                   # [edge]
          security-section.ts               # [security]
          admin-section.ts                  # [admin]
          logging-section.ts                # [logging]
          build-section.ts                  # [build]
        IServerConfig.test.ts               # zod schema accept/reject shape tests
      CommandRouter.ts                      # orchestrates initiate->fanout->forward; per-correlation per-responder state machine (C2)
      CommandRouter.test.ts
      PresenceBroadcaster.ts                # join/leave -> room:presence (count + users)
      PresenceBroadcaster.test.ts
      ConnectionLifecycle.ts                # M24 — collapsed: onHandshake / onRefresh / onDisconnect (replaces AuthHandshakeUseCase + RefreshTokenUseCase)
      ConnectionLifecycle.test.ts
      TokenLifecycle.ts                     # per-conn scheduler; uses setTimeout + Temporal directly (M23, no IClock/IScheduler)
      TokenLifecycle.test.ts                # vi.useFakeTimers() + vi.setSystemTime()
      hashUserId.ts                         # M12 — sha256(userId).slice(0,16) helper
      hashUserId.test.ts
      SignalRelay.ts                        # use case: receive signal:publish, ask ISignalTransport to broadcast signal:event, return recipientCount (M18)
      SignalRelay.test.ts
      IssueTurnCredentialsUseCase.ts        # pure: synthesizes {username, credential, ttl, urls} from sharedSecret + userId + nowEpochMs + ttlSec + urls (uses Node `crypto.createHmac('sha1')` directly — see §7.2)
      IssueTurnCredentialsUseCase.test.ts   # deterministic fixture; verifies HMAC against hand-computed reference value
      ports/
        ICommandTransport.ts                # M18 — split: broadcastRequest, emitResponse (manual fanout — C1)
        IPresenceTransport.ts               # M18 — split: emitPresence
        ISignalTransport.ts                 # M18 — split: broadcastSignalEvent
        ILifecycleTransport.ts              # M18 — split: emitTokenExpiring, emitTokenExpired, emitDraining, disconnect
        IServerLogger.ts                    # abstraction over pino
        IAuditLogger.ts                     # M4 — JSON-line audit channel
        IVerifierHealth.ts                  # M16/m5 — JWKS health surface for /health/ready
    infrastructure/
      SocketIORoomTransport.ts              # implements ICommandTransport, IPresenceTransport, ISignalTransport, ILifecycleTransport (M18); manual per-responder fanout (C1); PROXY proto v2 wrapper (C1)
      SocketIORoomTransport.integration.test.ts   # uses real socket.io-client
      PinoServerLogger.ts                   # implements IServerLogger
      PinoAuditLogger.ts                    # M4 — implements IAuditLogger via separate pino channel
      GoogleIdentityVerifier.ts             # implements IIdentityVerifier (jose + JWKS); algorithms ['RS256']; azp check; IVerifierHealth
      GoogleIdentityVerifier.integration.test.ts  # local keypair + in-memory JWKS HTTP server
      load-config.ts                        # ONLY file importing `config` package; merges TOML+env -> zod -> IServerConfig
      load-config.test.ts                   # required-key crash, env-var override, layered merge, getConfigSources, prod-NODE_ENV-vs-dev-config guard
    presentation/
      bootstrap.ts                          # createServer(deps): Promise<FastifyInstance>
      bootstrap.integration.test.ts         # boots full server, hits /health/{live,ready}, full auth flow w/ stub verifier
      socket-handlers.ts                    # io.use(...) middleware + io.on('connection', ...) glue + draining broadcast
      http-routes.ts                        # /health/live, /health/ready, /metrics; /admin/log-level on admin port
```

**File count:** 56 TypeScript source/test files (after this revision;
net +13 vs. the prior 43 — split `IRoomTransport.ts` into four ports
(M18, +3 net), added 10 zod section schemas in
`application/config/sections/` (m14, +10), removed monolithic
`IRoomTransport.ts` (-1) and the duplicated `IServerConfig.test.ts`
moved into the new sections-aware test (+1). Other tests adjusted
in-place). 20 test files (`*.test.ts` / `*.integration.test.ts`). 4
TOML config files (`default.toml`, `development.toml`,
`production.toml`, `test.toml`). 1 JSON config file
(`custom-environment-variables.json`). 1 Dockerfile. 1 README (now
operator/integrator-facing, ~150-300 lines — M19). 1 moon.yml. 1
package.json. 2 tsconfigs. **Provisioning shell-script set:** 2
orchestrators (`install.sh`, `upgrade.sh`) + 18 sub-scripts under
`scripts/lib/`, plus `docker-build.sh` and the bundle-hygiene TS
script `assert-server-deps-not-in-browser-bundle.ts` (m7). Additional
non-Node deployment artifacts rendered onto the host by the sub-
scripts (not stored in the repo): `/etc/haproxy/haproxy.cfg`,
`/etc/turnserver.conf`, the SAN cert from certbot, the renewal hook
`/etc/letsencrypt/renewal-hooks/deploy/communication.sh`,
`/etc/coturn/dhparam.pem`, `/etc/communication/turn-secret`,
`/etc/systemd/system/communication.service`,
`/etc/systemd/journald.conf.d/communication.conf`, and
`/etc/logrotate.d/coturn`.
(`local.toml` is intentionally not committed — gitignored — so it does
not appear in any count.)

**File-tree delta vs. the previous draft of this plan:**

- **Removed (M22, M23, M24):** `IClock.ts`, `IScheduler.ts`,
  `SystemClock.ts`, `NodeScheduler.ts` (TokenLifecycle uses `setTimeout`
  + `Temporal` directly; tests use `vi.useFakeTimers()` +
  `vi.setSystemTime()`). `AuthHandshakeUseCase[.test].ts`,
  `RefreshTokenUseCase[.test].ts` — collapsed into `ConnectionLifecycle`.
  `ResponderTimeoutError`, `ResponderDisconnectedError` (dead code; the
  discriminated `kind` markers replace them).
- **Renamed (M26):** `domain/RoomRegistry.ts` → `domain/IRoomRegistry.ts`
  — file name follows primary export.
- **Moved (M25):** `IServerConfig.ts` and `server-config-schema.ts` from
  `domain/` to `application/config/`.
- **Added (M4, M12, M16, m5, m7):** `application/hashUserId.ts`,
  `application/ports/IAuditLogger.ts`,
  `application/ports/IVerifierHealth.ts`,
  `infrastructure/PinoAuditLogger.ts`,
  `scripts/assert-server-deps-not-in-browser-bundle.ts`.
- **Added (signaling + TURN scope):** `domain/Signal.ts`,
  `application/SignalRelay.ts` (+ test),
  `application/IssueTurnCredentialsUseCase.ts` (+ test).
  `presentation/socket-handlers.ts` extended with `signal:publish` and
  `turn:request-credentials` event handlers.
  `domain/protocol.ts` extended with `SIGNAL_PUBLISH = 'signal:publish'`,
  `SIGNAL_EVENT = 'signal:event'`,
  `TURN_REQUEST_CREDENTIALS = 'turn:request-credentials'`.
  `domain/protocol-validators.ts` extended with the wrapper-only zod
  schemas (signal payload itself stays opaque).
- **Split (M18 — port god-object decomposition):**
  `application/ports/IRoomTransport.ts` is removed; replaced by four
  narrower ports in `application/ports/` —
  `ICommandTransport.ts`, `IPresenceTransport.ts`,
  `ISignalTransport.ts`, `ILifecycleTransport.ts`.
  `infrastructure/SocketIORoomTransport.ts` keeps a single
  implementation but now `implements` all four interfaces.
- **Added (config sections — m14):** `application/config/sections/`
  with one file per TOML section
  (`server-section.ts`, `auth-section.ts`, `room-section.ts`,
  `signal-section.ts`, `turn-section.ts`, `edge-section.ts`,
  `security-section.ts`, `admin-section.ts`, `logging-section.ts`,
  `build-section.ts`). `server-config-schema.ts` composes them.
- **Refactored (provisioning — Part A):** monolithic `install.sh` and
  `upgrade.sh` are replaced by an orchestrator + `lib/` sub-script
  layout (see §15.7). Each orchestrator runs LOCALLY on the operator's
  machine and shells out via ssh; each sub-script runs ON the target
  and is independently idempotent and unit-testable.
- **Net change vs. very first (pre-auth) plan: +35 source
  files** — the auth additions plus the two `IServerConfig` files,
  less the retired loader pair, plus the signaling/TURN additions,
  plus the M18 port split and the m14 config-section split.

**Decision: Node `crypto` directly in the use case (no
`HmacSha1Credential` port).** Earlier drafts considered an
`infrastructure/HmacSha1Credential.ts` thin port over
`crypto.createHmac('sha1')`. Skipped — `node:crypto` is stdlib, fully
deterministic, and ships with Node. Adding a port would only buy us
mocking-for-mocking's-sake. The pure use case calls `node:crypto`
directly; this remains testable because the inputs (`sharedSecret`,
`userId`, `nowEpochMs`, `ttlSec`, `urls`) are all injected. Reasoning
recorded explicitly per the "verify necessity of new solutions" rule
in CLAUDE.md.

### 7.2 Per-File Purpose (one line each)

#### Configuration
- **`Dockerfile`** — multi-stage build: `node:22-alpine` -> install with
  `corepack pnpm install --frozen-lockfile --filter @frozik/communication...` ->
  `pnpm --filter @frozik/communication build` -> runtime stage with prod deps
  only and `node dist/main.js` as ENTRYPOINT. No native deps required (`jose`
  is pure JS).
- **`README.md`** — operator/integrator-facing doc, ~150-300 lines (M19).
  Sections: dev quickstart; prod deploy (one-liner with example args
  for the orchestrator, e.g.
  `bash scripts/install.sh --ssh-host root@1.2.3.4 --google-client-id ...
  --cert-email ops@example.com`); Google OAuth client setup (link to
  Google Cloud console + required scopes `openid profile email` +
  redirect URI); env-var table; endpoint summary (`:443` Socket.IO via
  HAProxy, `:3478` STUN/TURN, `:5349` TURNS via HAProxy in default mode
  — under `--no-haproxy`, `:5349` is the public TURNS port);
  protocol summary with one example per event (`command:initiate`,
  `signal:publish`, `turn:request-credentials`); link to `server.md`
  for design rationale only.
- **`moon.yml`** — `language: typescript`, `layer: application`,
  `stack: backend`, `tags: [application]`, tasks: `build` (`pnpm run build`),
  `dev` (`pnpm run dev`, `persistent: true`), `type-check`, `madge`,
  `start` (`pnpm run start`).
- **`package.json`** — `@frozik/communication`, `private: true`,
  `type: module`, `main: dist/main.js`, scripts `build / dev / start /
  types / test / server:install / server:upgrade`,
  `dependencies`: `@frozik/utils: workspace:*`, `devDependencies`:
  `@frozik/typescript-config: workspace:*`. **No local runtime deps;
  fastify/socket.io/zod/jose come from the hoisted root.** The
  `server:install` and `server:upgrade` scripts shell out to
  `scripts/install.sh` and `scripts/upgrade.sh` respectively — see §8.12
  for the exact `scripts` block. They are deliberately NOT named
  `install` / `upgrade`: `install` is a reserved npm/pnpm lifecycle hook
  that would fire on every `pnpm install` in the monorepo and break the
  dev flow.
- **`tsconfig.json`** — extends `@frozik/typescript-config/node`.
- **`tsconfig.build.json`** — extends `tsconfig.json`, `noEmit: false`.
- **`scripts/docker-build.sh`** — `docker build -t communication:local
  -f apps/communication/Dockerfile .` from repo root.
- **`scripts/install.sh`** — orchestrator. Runs LOCALLY on the operator's
  machine (or a CI runner). Args:
  `--ssh-host <user@IP> --google-client-id <ID> --cert-email <EMAIL>
  [--no-haproxy] [--domain <hostname>]`. Required-arg validation lives
  in `lib/parse-args.sh`; missing args print usage and exit 2. Rsyncs
  `lib/` to `/tmp/communication-install-<timestamp>/` on the target,
  then invokes each sub-script in order via
  `ssh $SSH_HOST "cd /tmp/... && env VAR1=... bash lib/<script>.sh"`.
  On any sub-script failure (non-zero exit), the orchestrator stops
  and prints which step failed. NO `|| true` anywhere. Single
  human-readable progress trail across all sub-scripts (via the helpers
  in `lib/common.sh`). Order: parse-args → rsync → ensure-system-packages →
  ensure-system-user → ensure-repo-clone → build-app →
  generate-turn-secret → render-toml-configs → render-systemd-unit →
  render-renewal-hook → render-journald-conf → obtain-letsencrypt-cert
  (port 80 owned by certbot; HAProxy not yet started; ufw temporarily
  allows 80) → render-haproxy-cfg → render-coturn-cfg → configure-ufw
  (revoke 80) → enable-systemd-services (coturn, haproxy, communication;
  wait for /health/live) → smoke-test.
- **`scripts/upgrade.sh`** — orchestrator. Runs LOCALLY. Args:
  `--ssh-host <user@IP>`. Order: parse-args → rsync lib/ → pull-repo →
  install-deps → build-app → graceful-restart → smoke-test.
- **`scripts/lib/common.sh`** — `set -euo pipefail` + error trap
  helpers; `info` / `ok` / `warn` / `die` functions for color output;
  single source of truth for log formatting consumed by every sub-
  script.
- **`scripts/lib/parse-args.sh`** — sourced by both orchestrators;
  parses `--ssh-host`, `--google-client-id`, `--cert-email`,
  `--no-haproxy`, `--domain`; missing required → usage + exit 2.
- **`scripts/lib/remote-run.sh`** — ssh helper: rsync `lib/` once, then
  run any sub-script remotely with arbitrary env vars; surfaces remote
  exit code unchanged.
- **`scripts/lib/ensure-system-packages.sh`** — `apt install -y nodejs
  pnpm haproxy coturn certbot systemd-timesyncd ufw`; enables
  `systemd-timesyncd` (NTP, m6).
- **`scripts/lib/ensure-system-user.sh`** — `useradd -r communication`
  if missing; `chown -R communication:communication /opt/communication`.
- **`scripts/lib/ensure-repo-clone.sh`** — `sudo -u communication git
  clone https://...` (or `git pull --ff-only` if already cloned) into
  `/opt/communication`.
- **`scripts/lib/build-app.sh`** — `pnpm install --frozen-lockfile` +
  `pnpm --filter @frozik/communication build`.
- **`scripts/lib/generate-turn-secret.sh`** — idempotent. If
  `/etc/communication/turn-secret` exists with non-empty content, skip;
  otherwise `openssl rand -hex 32` and write
  `TURN_SHARED_SECRET=<hex>` (KEY=VALUE form for systemd
  `EnvironmentFile=`); `chmod 640`, `chown root:communication` so root
  AND the `communication` user can read it (M11 — the file is the ONE
  source of truth for the TURN secret).
- **`scripts/lib/render-toml-configs.sh`** — renders
  `/opt/communication/apps/communication/config/production.toml` and
  `custom-environment-variables.json`. Templates the public IP
  (discovered via `curl -s ifconfig.me` on the target, or a literal
  when `--domain` is provided), the realm (`turn-<IP>.sslip.io`), and
  the URL set — HAProxy mode uses `turns:turn-<IP>.sslip.io:443?...`,
  `--no-haproxy` mode uses `turns:turn-<IP>.sslip.io:5349?...` (M8).
- **`scripts/lib/render-haproxy-cfg.sh`** — renders
  `/etc/haproxy/haproxy.cfg`: exact `-m str` SNI matches; default
  backend is a `reject` block (M12); both backends use
  `send-proxy-v2` (C1) so Fastify and coturn see the original client
  IP; timeouts `connect 5s`, `client 1h`, `server 1h`, `tunnel 24h`
  (M13).
- **`scripts/lib/render-coturn-cfg.sh`** — renders
  `/etc/turnserver.conf`. Sources the secret file
  (`. /etc/communication/turn-secret`) so the literal secret is
  written as `static-auth-secret=$TURN_SHARED_SECRET` (M11 — single
  source of truth). Includes the full `denied-peer-ip=` set for
  RFC1918 + link-local + IPv6 ULA + IPv6 link-local + carrier-grade
  NAT (M6); `no-tlsv1`, `no-tlsv1_1`, `cipher-list="..."`,
  `ecdh-curve=prime256v1`, `dh-file=/etc/coturn/dhparam.pem`,
  `no-stun-backward-compatibility`, `no-tcp-relay` (M9);
  `no-stdout-log`, `verbose=0`,
  `log-file=/var/log/coturn/turnserver.log` (M10); `fingerprint`,
  `no-multicast-peers`, `no-loopback-peers`, `no-cli`;
  `listening-ip=127.0.0.1` for TURNS port 5349 in HAProxy mode (C3 —
  loopback-only TLS); 0.0.0.0 for plain TURN 3478 (external clients
  hit it directly); `total-quota=100`, `user-quota=4` (M7),
  `max-bps=2000000` (configurable); `realm=turn-<IP>.sslip.io` (m7).
- **`scripts/lib/render-systemd-unit.sh`** — renders
  `/etc/systemd/system/communication.service`:
  `EnvironmentFile=/etc/communication/turn-secret` (M11),
  `LimitNOFILE=65536`, `Restart=always`, `RestartSec=5s`,
  `TimeoutStopSec=$((shutdown_grace_ms/1000+5))s`, plus the env flag
  signalling Fastify to accept PROXY protocol on its listening port
  (C1 — wrapper inside `bootstrap.ts` parses PROXY proto v2 via
  `proxy-protocol-js` when `[edge] haproxy_enabled = true`). Cert
  files DO NOT need to exist yet at this point — the unit is written
  but not started until after `obtain-letsencrypt-cert.sh`.
- **`scripts/lib/render-renewal-hook.sh`** — renders
  `/etc/letsencrypt/renewal-hooks/deploy/communication.sh` with
  `#!/bin/sh`, `set -eu` (fail-fast — M15), `systemctl reload
  haproxy`, `systemctl reload coturn`,
  `systemctl kill -s SIGTERM communication`,
  `sleep $((shutdown_grace_ms/1000 + 5))`,
  `systemctl start communication`. NO `|| true` (M14, M15). At each
  ~60-day Let's Encrypt renewal, all active sessions drain via the
  M18 `server:draining` broadcast and reconnect; clients re-request
  TURN creds via `turn:request-credentials`. Zero-drop TLS context
  reload is deferred to v2.
- **`scripts/lib/render-journald-conf.sh`** — drops
  `/etc/systemd/journald.conf.d/communication.conf` with
  `SystemMaxUse=2G`; also writes `/etc/logrotate.d/coturn` with
  `rotate 3 daily compress` (M10) so coturn's per-allocation logs
  do not accumulate userIdHash records indefinitely.
- **`scripts/lib/render-cert-expiry-timer.sh`** — drops a systemd
  timer + service that runs `openssl x509 -checkend $((7*86400)) -in
  /etc/letsencrypt/live/communication/fullchain.pem` daily and emits
  a journald-warn on failure (M15).
- **`scripts/lib/obtain-letsencrypt-cert.sh`** — `certbot certonly
  --standalone -d <IP>.sslip.io -d turn-<IP>.sslip.io --cert-name
  communication --email <CERT_EMAIL>`. Asserts port 80 is free
  before invoking certbot (because no service binds :80 — UFW
  temporarily allows 80/tcp during this step, then `configure-ufw.sh`
  revokes). Generates `/etc/coturn/dhparam.pem` via `openssl dhparam
  -out /etc/coturn/dhparam.pem 2048` (idempotent: skip if exists).
- **`scripts/lib/configure-ufw.sh`** — mode-conditional firewall.
  HAProxy mode: allow `443/tcp`, `3478/udp`, `3478/tcp`, `22/tcp`;
  deny everything else (C3 — coturn TLS 5349 is loopback-only and
  must NOT be allowed externally). `--no-haproxy` mode: additionally
  allow `5349/tcp`. Temporarily allow 80/tcp for certbot
  (orchestrator handles the temporary opening before
  `obtain-letsencrypt-cert.sh` and revokes here at the end).
- **`scripts/lib/enable-systemd-services.sh`** — `systemctl
  daemon-reload`; `systemctl enable --now coturn haproxy
  communication` in that order; curl-loops `/health/live` with a
  timeout before declaring success.
- **`scripts/lib/pull-repo.sh`** — upgrade flow: `sudo -u
  communication git pull --ff-only` in `/opt/communication`.
- **`scripts/lib/install-deps.sh`** — upgrade flow: `pnpm install
  --frozen-lockfile`.
- **`scripts/lib/graceful-restart.sh`** — upgrade flow, 2-phase per
  M18: `systemctl kill -s SIGTERM communication`; wait
  `shutdown_grace_ms+5s`; `systemctl restart communication`; verify
  `/health/live`.
- **`scripts/lib/smoke-test.sh`** — `curl /health/live` + `curl
  /health/ready` + `systemctl is-active coturn haproxy
  communication`.

#### `src/main.ts`
- The composition root. Calls `loadConfig()` exactly once (the only
  call site in the entire codebase), then constructs
  `GoogleIdentityVerifier` (which also implements `IVerifierHealth`),
  `PinoAuditLogger`, calls
  `bootstrap({ config, verifier, auditLogger, verifierHealth })`, then
  `app.listen({ port: config.server.port, host: config.server.host })`.
  Wires `SIGTERM` / `SIGINT` -> two-phase shutdown (M18): (1) refuse
  new upgrades + broadcast `server:draining` + flip `/health/ready` to
  503; (2) wait up to `config.server.shutdown_grace_ms`; (3)
  `app.close()`, exit 0. Crashes the process on any startup error with
  a descriptive log line. ~70 lines.

#### `src/domain/`
- **`types.ts`** — `RoomId`, `UserId`, `DisplayName` as `Opaque<>`
  (m12 — Opaque brands kept only on identity-bearing types).
  `SocketId`, `CorrelationId`, `CommandName`, `IsoDateTime` are plain
  string aliases. Factories: `assertRoomId(raw): RoomId` (validates
  UUID v4 via zod, throws `InvalidHandshakeError`),
  `assertDisplayName(raw): DisplayName` (validates non-empty,
  ≤ `MAX_DISPLAY_NAME_LENGTH` chars, via zod), `assertUserId(raw):
  UserId`.
- **`constants.ts`** — **protocol-level invariants only.** Event-name
  string literals (`COMMAND_INITIATE = 'command:initiate'`,
  `COMMAND_EXECUTE`, `COMMAND_RESPONSE`, `ROOM_PRESENCE`,
  `AUTH_TOKEN_EXPIRING`, `AUTH_TOKEN_EXPIRED`, `AUTH_REFRESH_TOKEN`),
  the protocol-fixed `MAX_DISPLAY_NAME_LENGTH = 50` (an invariant of
  the wire contract, not a tunable), the Google issuer set
  (`GOOGLE_ISSUERS = Object.freeze(['https://accounts.google.com', 'accounts.google.com'] as const)`),
  and `GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'`
  (an immutable Google spec value). **Removed from this file vs. the
  previous draft:** `MAX_LISTENERS_PER_ROOM`, `RESPONSE_GATHER_TIMEOUT_MS`,
  `MAX_HTTP_BUFFER_BYTES`, `DEFAULT_PORT`,
  `TOKEN_EXPIRY_WARNING_SECONDS_DEFAULT`, `PRESENCE_LOG_INTERVAL_MS` —
  these are now config-driven (see §8.2 for the TOML keys).
- **`errors.ts`** — `RoomFullError` (variants
  `'too-many-listeners' | 'too-many-tabs'`), `InvalidHandshakeError`,
  `InvalidTokenError`, `TokenExpiredError`, `JwksUnreachableError`,
  `ConfigValidationError`. Each extends `Error`, has a typed
  `code: AuthErrorCode | RoomErrorCode`, and a `toClientPayload()` for
  `connect_error`. **Removed (M22):** `ResponderTimeoutError`,
  `ResponderDisconnectedError` — these were dead code; the discriminated
  `kind: 'timeout' | 'responder-disconnected'` markers on
  `IResponsePayload` replace them.

**Result-vs-throw policy (M22).** Cross-layer outcomes (use-case
returns, port methods, infrastructure that wraps an external system)
return `Result<T, E>` consistently. Throwing is reserved for invariant
violations (`assert(...)` from `@frozik/utils`),
`ConfigValidationError` at boot, and unrecoverable startup errors.
- **`Identity.ts`** — `Identity = { userId: UserId; displayName: DisplayName }`,
  `TokenClaims = { sub: UserId; exp: Milliseconds; iss: string; aud: string }`,
  `AuthErrorCode` union as in §6, plus the tiny `Result<T, E>` discriminated
  union used by the verifier port (`{ ok: true; value: T } | { ok: false;
  error: E }`).
- **`IIdentityVerifier.ts`** — port:
  `interface IIdentityVerifier { verify(idToken: string): Promise<Result<TokenClaims, AuthErrorCode>> }`.

(M25 — `IServerConfig.ts` and `server-config-schema.ts` previously lived
in `domain/`; they have been moved to `application/config/` because
config validation is an orchestration concern, not a domain invariant.
The new entries appear under `src/application/` below.)
- **`protocol.ts`** — exports the interfaces in §6.2 plus event-name
  constants: `COMMAND_INITIATE = 'command:initiate'`, `COMMAND_EXECUTE`,
  `COMMAND_RESPONSE`, `ROOM_PRESENCE`, `AUTH_TOKEN_EXPIRING`,
  `AUTH_TOKEN_EXPIRED`, `AUTH_REFRESH_TOKEN`. All string literals captured
  here.
- **`protocol-validators.ts`** — zod schemas for `IHandshakeAuth`,
  `IInitiatePayload`, `IExecuteAck`, `IRoomPresenceEvent`,
  `IAuthTokenExpiringEvent`, `IAuthRefreshTokenPayload`,
  `IAuthRefreshTokenAck`, `IRequestPayload`, `IResponsePayload`. Exports
  `parseHandshakeAuth`, `parseInitiatePayload`, etc. — each returns a typed
  value or throws `InvalidPayloadError` / `InvalidHandshakeError`.
- **`Room.ts`** — pure aggregate:
  ```ts
  class Room {
    readonly id: RoomId;
    private members: Map<SocketId, Identity>;
    addMember(socketId: SocketId, identity: Identity): Result<void, RoomFullError>;
    removeMember(socketId: SocketId): void;
    count(): number;
    canAccept(): boolean;
    everyOther(initiator: SocketId): SocketId[];
    getUsers(): ReadonlyArray<Identity>;
    getIdentity(socketId: SocketId): Identity | null;
    getMembers(): ReadonlyMap<SocketId, Identity>;       // C3 — snapshot source
  }
  ```
  Zero side effects, zero imports beyond domain peers and `@frozik/utils`.
- **`IRoomRegistry.ts`** (M26 — file name follows primary export) —
  interface
  `IRoomRegistry { ensure(roomId): Room; release(roomId, socketId): void; getRoom(roomId): Room | null; size(): number; totalMembers(): number }`.
- **`InMemoryRoomRegistry.ts`** — `Map<RoomId, Room>` implementation.

#### `src/application/`
- **`config/IServerConfig.ts`** (M25) — typed shape of the merged
  configuration. Plain TypeScript interface; no runtime imports.
- **`config/server-config-schema.ts`** (M25) — zod
  `ServerConfigSchema` and `parseServerConfig(raw: unknown): IServerConfig`.
  The schema includes a `.refine()` (m8) that, when
  `NODE_CONFIG_ENV === 'production'`, requires
  `cors_allowed_origins.length > 0` AND rejects the literal `["*"]`.
  `infrastructure/load-config.ts` imports `parseServerConfig` and
  applies it to the merged `node-config` object.
- **`ports/ICommandTransport.ts`** (M18) —
  `interface ICommandTransport { broadcastRequest(roomId, initiatorSocketId, request, options: { timeoutMs: Milliseconds; signal: AbortSignal }): AsyncIterable<TransportAckResult>; emitResponse(socketId, response): void }`.
  **Manual fanout contract (NOT `socket.to(room).timeout(t).emitWithAck(...)` — that returns a single batched array of acks).** The transport snapshots responder socket handles via `await io.in(roomId).fetchSockets()` (excluding the initiator), then issues per-responder
  `responderSocket.timeout(timeoutMs).emitWithAck('command:execute', request)` IN PARALLEL. Each promise settles independently — yield each result the moment it resolves or rejects. The transport also subscribes each responder's `'disconnect'` event during the in-flight window so that a disconnect short-circuits the wait with `kind: 'responder-disconnected'` instead of waiting for the timeout. The `AsyncIterable<TransportAckResult>` is implemented via a hand-rolled async generator using a queue + pump pattern: completed results are pushed onto an internal queue and the generator's `next()` drains the queue (or awaits the next push). When the caller-supplied `AbortSignal` fires, the generator stops yielding and any remaining in-flight emits are abandoned (no further `emitResponse` calls).
- **`ports/IPresenceTransport.ts`** (M18) —
  `interface IPresenceTransport { emitPresence(roomId, payload): void }`.
  Used only by `PresenceBroadcaster`.
- **`ports/ISignalTransport.ts`** (M18) —
  `interface ISignalTransport { broadcastSignalEvent(roomId, excludingSocketId, event): number }`.
  Used only by `SignalRelay`. Returns `recipientCount`
  (`room.size - 1`).
- **`ports/ILifecycleTransport.ts`** (M18) —
  `interface ILifecycleTransport { emitTokenExpiring(socketId, payload): void; emitTokenExpired(socketId): void; emitDraining(roomId): void; disconnect(socketId, reason): void }`.
  Used by `ConnectionLifecycle` and the SIGTERM handler.
- **`ports/IServerLogger.ts`** — `interface IServerLogger { info / warn /
  error(obj, msg?): void }` — pino subset.
- **`ports/IAuditLogger.ts`** (M4) —
  `interface IAuditLogger { record(record: { event: string; timestamp: IsoDateTime; userIdHash: string; roomId: RoomId; correlationId?: CorrelationId; command?: CommandName }): void }`.
  v1 implementation (`PinoAuditLogger`) writes to a separate pino
  channel (`audit:`); journald rotation handles retention.
- **`ports/IVerifierHealth.ts`** (M16/m5) —
  `interface IVerifierHealth { recordSuccess(): void; recordFailure(reason: string): void; getSnapshot(): { lastSuccessAt: IsoDateTime | null; lastFailureAt: IsoDateTime | null; consecutiveFailures: number } }`.
  `GoogleIdentityVerifier` calls `recordSuccess`/`recordFailure` per
  JWKS fetch outcome; `/health/ready` reads `getSnapshot()`.
- **`hashUserId.ts`** (M12) —
  `export function hashUserId(userId: UserId): string` returning
  `sha256(userId).hex.slice(0, 16)`. Pure function; sole entry point
  for any code that wants to log user identity. Tests verify
  determinism + length.
- **`TokenLifecycle.ts`** (M23 — no IClock/IScheduler) — class:
  ```ts
  class TokenLifecycle {
    constructor(deps: { warningSeconds: number });
    arm(claims: TokenClaims, callbacks: {
      onWarning: (event: IAuthTokenExpiringEvent) => void;
      onExpired: () => void;
    }): void;
    disarm(): void;
    replaceClaims(claims: TokenClaims): void;
  }
  ```
  Reads `Temporal.Now.instant().epochMilliseconds` directly and uses
  Node's global `setTimeout` / `clearTimeout` to schedule the warning
  and expiry callbacks. **Generation guard (M6):** every `arm` and
  `replaceClaims` increments a `generation: number` field. Each
  scheduled callback captures the generation it was scheduled under;
  on fire it compares to `this.generation` and bails silently if
  stale. This eliminates the race where a `replaceClaims` redirects
  the timer but the previous warning callback was already in the
  microtask queue. Tests use `vi.useFakeTimers()` +
  `vi.setSystemTime()` — no fake clock/scheduler abstraction.
- **`CommandRouter.ts`** — `routeInitiate(initiatorSocketId, roomId,
  initiate): Promise<IInitiateAck>`. **Ack-before-fanout rule (M1):** the router
  ALWAYS resolves the `command:initiate` ack to the initiator first (with
  `socketCount`, `users[]`, `correlationId` snapshot, or rejection `kind`),
  THEN begins the broadcast phase. The initiator-Identity snapshot taken at
  this moment is stable and is propagated unchanged into every downstream
  `IExecutePayload.initiator`.
  **Identity snapshot at fanout start (C3):** at the moment `routeInitiate`
  enters its broadcast phase, the router builds
  `Map<SocketId, Identity>` from `Room.getMembers()`. This snapshot
  populates the `responder` field for ALL THREE response `kind`s
  (`'ok' | 'timeout' | 'responder-disconnected'`). The snapshot survives even
  if `ConnectionLifecycle.onDisconnect` clears `Room.members` mid-flight, so
  the initiator always learns who timed out / disconnected.
  **Per-correlation per-responder state machine (C2):** server-internal
  pending state is keyed on the tuple
  `(correlationId, dispatchInstanceId, responderSocketId)`, where
  `dispatchInstanceId` is a monotonic counter incremented per-socket per
  `command:initiate`. Each entry has states
  `Pending → Settled(ok | timeout | disconnected)` with EXACTLY ONE allowed
  transition. The implementation uses
  `Promise.race([emitWithAck, timeoutSignal, disconnectSignal])` per
  responder; whichever resolves first marks the entry `Settled` and
  `transport.emitResponse(...)` fires exactly once. Late-arriving acks
  (e.g. an ack that arrives after the timeout has already fired) are
  silently dropped at `debug` level — they cannot produce a second
  `command:response`. The wire-level `correlationId` is preserved
  unchanged across the whole flow; `dispatchInstanceId` is purely
  server-internal.
  **In-flight cancellation (M2):** the fanout pump uses an `AbortSignal`
  bound to the initiator socket; on initiator disconnect the signal fires,
  the async generator stops yielding, and `transport.emitResponse` is not
  called for any remaining responders.
  **Per-socket back-pressure (M8):** before fanout starts the router
  consults the per-socket in-flight counter. If the socket already has
  `room.max_inflight_dispatches_per_socket` (default 32) outstanding
  correlations, the ack returned to the initiator is
  `command:response { kind: 'dispatch-rejected', reason: 'too-many-in-flight', correlationId }`
  and no fanout is performed. Counter increments on accept, decrements on
  every `Settled` transition or on initiator disconnect.
  **Orphan handling (M7):** on initiator disconnect (any reason), the
  per-correlation state for that initiator is removed and any
  late-arriving responder acks are silently dropped at `debug`. Metric
  `communication_orphaned_responses_total` is incremented per dropped ack.
- **`PresenceBroadcaster.ts`** — class with `onJoin(roomId)` and
  `onLeave(roomId)`. Both compute the new count + `users[]` (from
  `Room.getUsers()`) and call `transport.emitPresence`.
- **`ConnectionLifecycle.ts`** (M24 — collapses the previous
  `AuthHandshakeUseCase` and `RefreshTokenUseCase` into one class).
  Public surface:
  ```ts
  class ConnectionLifecycle {
    onHandshake(socket, auth): Promise<Result<{ identity, claims, roomId }, AuthErrorCode | RoomErrorCode>>;
    onRefresh(socket, idToken): Promise<Result<{ expiresAt }, AuthErrorCode>>;
    onDisconnect(socket): void;
  }
  ```
  - `onHandshake`: zod-parses raw `auth` (→ `auth/missing-fields` on
    failure), validates `displayName` and `roomId`, calls
    `IIdentityVerifier.verify(idToken)`, runs the per-IP rate-limit
    check (M11), runs `azp` check (M9) inside the verifier, builds
    `Identity`, calls `room.addMember(socketId, identity)` (subject to
    `max_listeners` and `max_tabs_per_user`), arms `TokenLifecycle`
    (where `onExpired` calls `transport.emitTokenExpired(socketId)`
    then `transport.disconnect(...)`), then `socket.join(roomId)` and
    `presenceBroadcaster.onJoin(roomId)` (in that order — see M4).
  - `onRefresh`: zod-parses payload, calls `IIdentityVerifier.verify`,
    enforces M10 binding rules (`sub` must match;
    `iat` must strictly increase; `sid` must match if present), on
    success calls `tokenLifecycle.replaceClaims(newClaims)`. Returns
    `{ ok: true, expiresAt }` or `{ ok: false, error }`. Does NOT
    disconnect on failure.
  - `onDisconnect`: `tokenLifecycle.disarm()`;
    `room.removeMember(socketId)`; `registry.release(...)`;
    `presenceBroadcaster.onLeave(roomId)`; cancels the
    `AbortController` for any in-flight `routeInitiate` from this
    socket; clears the per-socket in-flight counter (M8).
  Tests still cover every code path that the two old use cases covered
  — the test surface is unchanged in coverage; only the class boundary
  collapsed.
- **`SignalRelay.ts`** — pure use case for `signal:publish`. Depends
  on `ISignalTransport` only (M18). Public surface:
  ```ts
  class SignalRelay {
    constructor(deps: {
      transport: ISignalTransport;
      registry: IRoomRegistry;
      auditLogger: IAuditLogger;
      logger: IServerLogger;
      maxPublishPerSecond: number;       // M1 — refill rate
      maxPublishBurst: number;           // M1 — token-bucket size
      maxPayloadBytes: number;           // m1
    });
    publish(input: {
      socketId: SocketId;
      identity: Identity;                 // M3 — extended with socketId
      roomId: RoomId;
      payload: unknown;
      payloadBytes: number;               // measured at the wire layer
      correlationId?: CorrelationId;
    }): Result<{ recipientCount: number }, 'rate-limited' | 'not-in-room' | 'invalid-payload' | 'payload-too-large' | 'internal'>;
  }
  ```
  - Validates `payload != null` (m1 — `invalid-payload`) and
    `payloadBytes <= maxPayloadBytes` (m1 — `payload-too-large`).
  - Looks up the room; missing room → `not-in-room` (m2 — supersedes
    `'internal'` for that case).
  - Enforces the per-socket publish rate limit using a token-bucket
    counter keyed on `socketId` (refill `maxPublishPerSecond` tokens
    per second; bucket size `maxPublishBurst`). The signaling rate
    counter is SEPARATE from `max_inflight_dispatches_per_socket` —
    they account different traffic (m3).
  - Asks `transport.broadcastSignalEvent(roomId, socketId, { payload,
    from: identity, correlationId })` to fan out the `signal:event`
    to every other socket in the room. **Synchronous between
    rate-limit-check and emit (m4)** — no `await` between the bucket
    consume and the `socket.to(room).emit` call.
    `correlationId` is opaque and passed through unchanged (m3).
  - Returns `{ recipientCount }` from the transport, which counts the
    sockets that received the broadcast at the moment of emission as
    `room.size - 1` (m5 — excludes publisher; no per-user dedup).
  - Logs at `debug` (high volume): `signal:publish` with
    `userIdHash`, `roomId`, `recipientCount`. No payload content
    logged.
- **`IssueTurnCredentialsUseCase.ts`** — **pure** use case (M22 result
  shape). Server-side rate limiting (M7 —
  `[turn] credential_requests_per_minute_per_socket`) is enforced one
  layer up by the socket handler before this use case runs. Public surface:
  ```ts
  function issueTurnCredentials(input: {
    sharedSecret: string;
    userId: UserId;
    nowEpochMs: number;       // Temporal.Now.instant().epochMilliseconds
    ttlSeconds: number;
    urls: ReadonlyArray<string>;
  }): Result<
    { username: string; credential: string; ttl: number; urls: ReadonlyArray<string> },
    'internal'
  >;
  ```
  - Asserts `sharedSecret.length > 0` via `assert` from `@frozik/utils`
    (boot config validation prevents empty in production; this is a
    belt-and-braces check).
  - Computes
    `username = ${Math.floor(nowEpochMs / 1000) + ttlSeconds}:${hashUserId(userId)}`
    using `hashUserId` (M12) so the same 16-char redacted hash is
    used in logs and TURN creds.
  - Computes `credential = createHmac('sha1', sharedSecret).update(username).digest('base64')`
    via `node:crypto` directly (M5 — secret-first arg order pinned by
    the unit test). No port abstraction — see §7.1 "Decision: Node
    `crypto` directly". `Buffer` is the standard Node API for both
    HMAC update input and base64 output; no need to introduce a `IHmac`
    port.
  - Returns `{ username, credential, ttl: ttlSeconds, urls }`.
  - Deterministic for a fixed `(sharedSecret, userId, nowEpochMs,
    ttlSeconds, urls)` tuple — verified by test against a hand-computed
    HMAC reference value.

#### `src/infrastructure/`
- **`SocketIORoomTransport.ts`** — implements all four transport ports
  (`ICommandTransport`, `IPresenceTransport`, `ISignalTransport`,
  `ILifecycleTransport` — M18) against a `Server` instance. Adds the
  lifecycle methods (`emitTokenExpiring`, `emitTokenExpired`,
  `emitDraining`, `disconnect`) and the signaling fanout
  (`broadcastSignalEvent`). **Manual fanout
  implementation (C1):** `broadcastRequest` does NOT use
  `socket.to(room).timeout(t).emitWithAck(...)` (that helper returns a
  single batched array, defeating per-responder streaming). Instead it
  awaits `io.in(roomId).fetchSockets()` to snapshot remote socket handles
  excluding the initiator, then for each responder calls
  `responderSocket.timeout(timeoutMs).emitWithAck('command:execute', request)`
  in parallel. It registers a one-shot `'disconnect'` listener on each
  responder for the lifetime of the request to short-circuit with
  `kind: 'responder-disconnected'`. Results are pushed onto an internal
  queue; the returned async generator drains the queue (or awaits the
  next push), honouring `options.signal` to stop yielding on initiator
  disconnect.
- **`PinoServerLogger.ts`** — minimal wrapper over `app.log`.
- **`GoogleIdentityVerifier.ts`** — implements `IIdentityVerifier`. On
  construction creates a `jose.createRemoteJWKSet(new URL(GOOGLE_JWKS_URL))`
  (single-instance JWKS cache). Also implements `IVerifierHealth` (M16/m5):
  records `lastSuccessAt`, `lastFailureAt`, and `consecutiveFailures` for
  every JWKS fetch, surfaced via `/health/ready`. `verify(idToken)`:
  - `jose.jwtVerify(idToken, jwks, { algorithms: ['RS256'], issuer: [...GOOGLE_ISSUERS], audience: clientId, clockTolerance: config.auth.clock_tolerance_seconds })`.
    **`algorithms: ['RS256']` is REQUIRED** (C4) — defeats `none` /
    HS256-with-public-key / algorithm-confusion attacks. Google ID tokens
    are RS256; pinning the allowlist is the standard mitigation.
  - On success, narrow `payload.sub`, `payload.exp`, `payload.iss`, `payload.aud`,
    `payload.name` (REQUIRED — M13), and `payload.azp` (optional) — use
    `assert(...)` from `@frozik/utils` to narrow nullable fields. Build
    `Identity { userId: payload.sub, displayName: payload.name }`. If
    `payload.name` is absent → return `{ ok: false; error: 'auth/missing-name-claim' }`.
  - **`azp` audience check (M9):** if `payload.azp` is present, assert
    `payload.azp === config.auth.google_oauth_client_id`. Mismatch →
    `auth/wrong-audience`.
  - Return `{ ok: true; value: TokenClaims }` where claims include `sid`
    if present (used by refresh comparison; see §6.5/M10).
  - Maps known `jose` errors: `JWTExpired -> auth/expired-token`,
    `JWTClaimValidationFailed (claim='aud') -> auth/wrong-audience`,
    `JWTClaimValidationFailed (claim='iss') -> auth/wrong-issuer`,
    `JWSSignatureVerificationFailed | JWSInvalid | JWTInvalid ->
    auth/invalid-token`, `JOSEAlgNotAllowed -> auth/invalid-token`,
    `JWKSNoMatchingKey | network errors -> auth/jwks-unreachable`.
    Anything else -> `auth/invalid-token`. The original `jose` error
    message is logged at `warn` server-side with `socketId` and `code`,
    NEVER propagated to `connect_error.message` or `ack.error` (M15).
- **`PinoAuditLogger.ts`** (M4) — implements `IAuditLogger` via a
  separate pino channel (`bindings: { channel: 'audit' }`). One JSON
  line per record; consumed by journald in production.
- **`load-config.ts`** — the only file in the codebase that imports
  `config` (the `node-config` package). Exports two functions:
  - `loadConfig(): IServerConfig` — calls `config.util.toObject()` to
    materialise the merged TOML + env-var view, then runs it through
    `parseServerConfig` (zod from `domain/IServerConfig.ts`). Throws a
    `ConfigValidationError` on schema failure with a descriptive
    multi-line message listing each invalid path and (where
    applicable) the env var that should override it.
  - `loadConfigFromObject(raw: unknown): IServerConfig` — same
    validation pipeline but skips the filesystem and the `config`
    singleton. Used by tests.
  No other module imports `config`. Verified by a domain/application
  layer-import test (§5.3) that asserts the `config` package never
  appears in domain/application transitive imports.

#### `src/presentation/`
- **`bootstrap.ts`** — `export async function createServer(deps: {
    config: IServerConfig;
    verifier: IIdentityVerifier;
    auditLogger: IAuditLogger;
    verifierHealth: IVerifierHealth;
  }): Promise<{ app: FastifyInstance; close: () => Promise<void> }>`.
  Builds Fastify, registers `@fastify/rate-limit` (M11), registers
  `http-routes` (`/health/live`, `/health/ready`, `/metrics`,
  `/admin/log-level` on the admin port), attaches Socket.IO with `cors`
  + `maxHttpBufferSize`, calls `registerSocketHandlers(...)`. Implements
  the two-phase shutdown handler (M18) so the returned `close()`
  emits `server:draining`, waits up to `shutdown_grace_ms`, then
  `app.close()`s. Every dependency injected — no module-level
  singletons. Makes integration tests trivial (stub `IIdentityVerifier`).
  No `IClock`/`IScheduler` in deps (M23 — `TokenLifecycle` uses
  `setTimeout` + `Temporal` directly; tests use `vi.useFakeTimers`).
- **`socket-handlers.ts`** —
  `registerSocketHandlers(io, deps: { router, presence, lifecycle, signalRelay, issueTurnCredentials, logger, config, auditLogger })`.
  Note: there is **no** `RefreshTokenUseCase` dep — that was collapsed
  into `ConnectionLifecycle.onRefresh` in M24 and is wired below.
  1. `io.use(authHandshakeMiddleware)` — calls `lifecycle.onHandshake(socket)`,
     attaches `Identity` + `TokenClaims` to `socket.data`, joins room.
     On error calls `next(err)` with `err.data = { code: AuthErrorCode | RoomErrorCode }`.
  2. `io.on('connection', socket => { ... })`:
     - Construct a `TokenLifecycle` per socket, `arm` with callbacks that
       wire to `transport.emitTokenExpiring(socket.id, ...)`, then
       `transport.emitTokenExpired(socket.id)` followed by
       `transport.disconnect(socket.id, 'auth/expired')` on expiry.
     - Register `command:initiate` handler -> `router.routeInitiate(...)`.
     - Register `auth:refresh-token` handler -> `lifecycle.onRefresh(socket, payload)`.
     - Register `signal:publish` handler ->
       `signalRelay.publish({ socketId: socket.id, identity: socket.data.identity, roomId: socket.data.roomId, payload, correlationId })`,
       returns the ack shape from §6.Y.1 (`{ ok: true, recipientCount }`
       on success, `{ ok: false, error }` on rate-limit / internal error).
       The handler validates the wrapper payload against
       `SignalPublishPayloadSchema` first; an invalid wrapper produces
       `{ ok: false, error: 'internal' }` (no protocol-error event — the
       client violated the wire contract).
     - Register `turn:request-credentials` handler ->
       `issueTurnCredentials({ sharedSecret: config.turn.shared_secret,
       userId: socket.data.identity.userId,
       nowEpochMs: Temporal.Now.instant().epochMilliseconds,
       ttlSeconds: config.turn.ttl_seconds, urls: config.turn.urls })`,
       returns the ack shape from §6.Z.1. When `config.turn.enabled ===
       false`, the handler is not registered at all (the event is
       silently absent — the client receives a Socket.IO ack timeout).
     - Register `disconnect` handler -> `lifecycle.onDisconnect(socket.id, roomId)`.
- **`http-routes.ts`** — `GET /health/live` (M16), `GET /health/ready`
  (M16 — JWKS health snapshot from `IVerifierHealth`),
  `GET /metrics` (M17 — OpenMetrics text via `prom-client`),
  `POST /admin/log-level` mounted on the admin port (m6).

#### Updates to existing files in this tree
*(Listed here so a reviewer can see what changed vs. the previous plan.)*

- `domain/protocol.ts` — added the auth event-name constants,
  `server:draining`, and updated payload interfaces to include `users`,
  `initiator`, `responder`, and the `dispatch-rejected` response kind
  (M8). Renamed events per global rename pass (M11/m10/m11).
- `domain/protocol-validators.ts` — zod schemas for all new auth
  payloads plus the updated request/response/presence shapes plus
  `IServerDrainingEvent`.
- `application/ConnectionLifecycle.ts` — collapsed (M24) to expose
  `onHandshake / onRefresh / onDisconnect`. Replaces
  `AuthHandshakeUseCase` and `RefreshTokenUseCase` (deleted).
- `application/PresenceBroadcaster.ts` — pulls `users` from each
  `Room`'s member `Identity` map (deduplicated by `userId`; see §13
  multi-tab).
- `application/TokenLifecycle.ts` — uses `setTimeout` + Temporal
  directly (M23 — `IClock`/`IScheduler` deleted). Generation guard
  (M6).
- `domain/Room.ts` — members are `Map<SocketId, Identity>` (was
  `Set<SocketId>`); new `getUsers()`, `getIdentity(...)`, and
  `getMembers()` methods. `addMember` enforces `max_listeners` AND
  `max_tabs_per_user` (m3).
- `domain/types.ts` — Opaque brand kept on `RoomId`, `UserId`,
  `DisplayName` only (m12).
- `domain/errors.ts` — added the auth errors listed above. Removed
  `ResponderTimeoutError`, `ResponderDisconnectedError` (M22).
- `domain/RoomRegistry.ts` → `domain/IRoomRegistry.ts` (M26).
- `infrastructure/SocketIORoomTransport.ts` — registers handshake
  middleware via `bootstrap`, manual per-responder fanout (C1), adds
  `emitTokenExpiring`, `emitTokenExpired`, `emitDraining`, `disconnect`.
- `infrastructure/GoogleIdentityVerifier.ts` — passes
  `algorithms: ['RS256']` (C4) and explicit
  `clockTolerance: config.auth.clock_tolerance_seconds` (m1) to
  `jose.jwtVerify`. Implements `IVerifierHealth` (M16/m5). `azp`
  audience check (M9).
- `infrastructure/load-config.ts` (the config loader) — owns the
  single call to `node-config`'s `config.util.toObject()`, hands the
  result to the zod schema in `application/config/server-config-schema.ts`
  (M25). Surfaces `getConfigSources()` in error messages (M21).
  Production-vs-dev guard (m2).
- `application/config/IServerConfig.ts` (M25 — moved from `domain/`):
  typed config shape.
- `application/config/server-config-schema.ts` (M25): zod schema with
  prod-CORS refine (m8).
- `presentation/socket-handlers.ts` — wires
  `ConnectionLifecycle.{onHandshake,onRefresh,onDisconnect}`,
  `@fastify/rate-limit` on the upgrade route, the
  `auth:refresh-token` handler, and the `server:draining` broadcast on
  shutdown (M18).

---

## 8. Configuration

### 8.1 File Layout — `apps/communication/config/`

```
apps/communication/config/
  default.toml                        # base — every key with a safe default
  development.toml                    # dev overrides (NODE_CONFIG_ENV=development)
  production.toml                     # prod overrides (NODE_CONFIG_ENV=production)
  test.toml                           # test overrides (NODE_CONFIG_ENV=test)
  custom-environment-variables.json   # env-var -> TOML key path mapping
  # local.toml -> .gitignored, NEVER committed (per-developer overrides)
```

`node-config` discovers this directory via the `NODE_CONFIG_DIR` env var (set
to `apps/communication/config` by `package.json` scripts and the Dockerfile).

**Layering precedence (low priority → high priority), per `node-config`
semantics:**

1. `default.toml`
2. `<NODE_CONFIG_ENV>.toml` (the env selector is **`NODE_CONFIG_ENV`**, not
   `APP_ENV` and explicitly **not** `NODE_ENV` — `NODE_CONFIG_ENV` decouples
   config-environment from Node's own `NODE_ENV`, which Fastify and pino
   still consume independently).
3. `local.toml` (gitignored; intended for personal developer overrides; not
   present in CI / production images).
4. Environment variables, mapped per `custom-environment-variables.json`.

Higher layers shadow individual keys from lower layers (deep merge per
`node-config` defaults). A missing layer is silently skipped — only
`default.toml` is required.

### 8.2 `default.toml` (full sample)

```toml
[server]
port = 4445
host = "0.0.0.0"
cors_allowed_origins = []                # empty in default = deny all; populated per env
shutdown_grace_ms = 11000                # M18 — drain window after SIGTERM (must be < systemd TimeoutStopSec)

[room]
max_listeners = 50
max_tabs_per_user = 5                    # m3 — per-userId cap inside one room
max_inflight_dispatches_per_socket = 32  # M8 — per-socket back-pressure for command:initiate
response_gather_timeout_ms = 10000
max_http_buffer_bytes = 1048576

[auth]
google_oauth_client_id = ""              # MUST be set via env or env-specific TOML
token_expiry_warning_seconds = 60
clock_tolerance_seconds = 5              # m1 — passed to jose.jwtVerify (jose default is 0)

[auth.jwks]
fetch_max_attempts = 3
fetch_timeout_ms = 5000

[security]
handshake_rate_per_ip_per_minute = 60       # M11 — @fastify/rate-limit budget on the upgrade route
failed_handshake_block_threshold = 10       # M11 — failed handshakes from one IP within the window before block
failed_handshake_block_seconds = 30         # M11 — block duration once threshold tripped (also acts as the sliding-window length)

[admin]
token = ""                              # m6 — shared secret for X-Admin-Token; empty disables /admin
port = 4446                             # m6 — separate port for /admin (localhost-only by default)
host = "127.0.0.1"

[logging]
level = "info"
pretty = false

[build]
id = "unknown"
commit = "unknown"
version = "unknown"

[signal]
max_publish_per_second_per_socket = 100  # M1 — token-bucket refill (Yjs awareness can burst)
max_publish_burst = 200                  # M1 — token-bucket size
max_payload_bytes = 16384                # m1 — wire-size cap for signal:publish

[turn]
enabled = true                           # set to false to disable turn:request-credentials entirely
shared_secret = ""                       # MUST be set via TURN_SHARED_SECRET env in production
realm = ""                               # set via env or per-env TOML; typically turn-<IP>.sslip.io (m7)
ttl_seconds = 43200                      # M4 — 12h default; bounded [60, 86400] by zod refine
credential_requests_per_minute_per_socket = 5   # M7 — server-side rate limit on turn:request-credentials
urls = []                                # populated by render-toml-configs.sh; example below

[server.tls]
enabled = false                          # off in dev; on in production
cert_path = ""                           # PEM path; ignored when enabled = false
key_path = ""                            # PEM path; ignored when enabled = false

[edge]
haproxy_enabled = true                   # default; install.sh writes "false" if --no-haproxy
```

Every key listed above MUST appear in `default.toml` so the zod schema can
rely on a base value. `auth.google_oauth_client_id` defaults to the empty
string; the zod schema rejects an empty string, so the server crashes at
startup unless an environment-specific TOML or an env-var override supplies a
real value. This is the intended fail-fast behaviour.

The same fail-fast rule applies to `turn.shared_secret` when
`turn.enabled = true` and `NODE_CONFIG_ENV === 'production'`: the zod schema
rejects empty `shared_secret` in that combination via a `.refine(...)` with
a clear error message pointing at `TURN_SHARED_SECRET`. In dev, an empty
secret is permitted but `turn:request-credentials` returns
`{ ok: false, error: 'internal' }` and logs a warning.

`turn.ttl_seconds` is bounded `[60, 86400]` (1 minute to 24 hours, M4)
at the zod layer. Default is `43200` (12 hours). Values outside the
range crash boot with a descriptive error.

### 8.3 Per-Environment Overrides

`development.toml` (loose, developer-friendly):
```toml
[server]
cors_allowed_origins = ["*"]             # accept all origins in dev

[auth]
google_oauth_client_id = "<dev-google-client-id-here>"   # safe — public identifier

[logging]
level = "debug"
pretty = true                            # pino-pretty
```

`production.toml` (strict; secrets MUST come from env vars):
```toml
[server]
cors_allowed_origins = []                # empty -> startup error if no env var sets it
port = 8443                              # behind HAProxy SNI on :443

[server.tls]
enabled = true
cert_path = "/etc/letsencrypt/live/communication/fullchain.pem"
key_path  = "/etc/letsencrypt/live/communication/privkey.pem"

[auth]
google_oauth_client_id = ""              # empty -> startup error if no env var sets it

[turn]
enabled = true
realm = ""                               # populated by render-toml-configs.sh to "turn-<IP>.sslip.io" (m7)
shared_secret = ""                       # populated via TURN_SHARED_SECRET env (sourced from /etc/communication/turn-secret)
# HAProxy mode (default) uses port 443 for TURNS; --no-haproxy mode uses 5349 (M8).
# render-toml-configs.sh templates the correct port at install time.
urls = [
  "turns:turn-<IP>.sslip.io:443?transport=tcp",
  "turn:turn-<IP>.sslip.io:3478?transport=udp",
  "turn:turn-<IP>.sslip.io:3478?transport=tcp",
]

[edge]
haproxy_enabled = true                   # install.sh writes "false" with --no-haproxy

[logging]
level = "info"
pretty = false                           # JSON lines
```

`test.toml` (fast, deterministic):
```toml
[server]
port = 0                                 # ephemeral
host = "127.0.0.1"
cors_allowed_origins = ["*"]

[room]
response_gather_timeout_ms = 100         # fast tests

[auth]
google_oauth_client_id = "test-client-id"
token_expiry_warning_seconds = 1

[logging]
level = "warn"
```

### 8.4 `custom-environment-variables.json` (env-var -> TOML key mapping)

`node-config` consumes this file automatically. **Keys mirror the TOML key
paths exactly.** The structure uses **nested objects** rather than dotted
keys, because `node-config` natively walks a JSON object tree to map
hierarchical config; while it accepts both forms in some places, nested
objects are the form used in the `node-config` documentation and across the
ecosystem. The whole tree below uses nested objects for that reason — a
single conventional form is easier to read than a mixed style. (Flagged in
§13 as a small ambiguity worth verifying empirically in step 2 of §14.)

```json
{
  "server": {
    "port": "PORT",
    "tls": {
      "enabled": "TLS_ENABLED",
      "cert_path": "TLS_CERT_PATH",
      "key_path": "TLS_KEY_PATH"
    }
  },
  "auth": {
    "google_oauth_client_id": "GOOGLE_OAUTH_CLIENT_ID",
    "jwks": {
      "fetch_max_attempts": "JWKS_FETCH_MAX_ATTEMPTS",
      "fetch_timeout_ms": "JWKS_FETCH_TIMEOUT_MS"
    }
  },
  "turn": {
    "shared_secret": "TURN_SHARED_SECRET",
    "realm": "TURN_REALM",
    "ttl_seconds": "TURN_TTL_SECONDS"
  },
  "edge": {
    "haproxy_enabled": "EDGE_HAPROXY_ENABLED"
  },
  "logging": {
    "level": "LOG_LEVEL"
  },
  "build": {
    "id": "BUILD_ID",
    "commit": "BUILD_COMMIT",
    "version": "BUILD_VERSION"
  }
}
```

| Env var | Maps to | Purpose | Secret? |
|---|---|---|---|
| `PORT` | `server.port` | HTTP/WS port (PaaS may inject a port number). | No |
| `GOOGLE_OAUTH_CLIENT_ID` | `auth.google_oauth_client_id` | OIDC `aud` claim. | **No** — Google OAuth client IDs are public identifiers (they ship in the SPA bundle). Treated as configuration, not a secret. |
| `JWKS_FETCH_MAX_ATTEMPTS` | `auth.jwks.fetch_max_attempts` | JWKS retry budget on cold start / cache miss. | No |
| `JWKS_FETCH_TIMEOUT_MS` | `auth.jwks.fetch_timeout_ms` | Per-attempt JWKS fetch timeout. | No |
| `LOG_LEVEL` | `logging.level` | pino level (`debug` | `info` | `warn` | `error`). | No |
| `BUILD_ID` | `build.id` | Surfaced via `/health`. Set by CI at run-start. | No |
| `BUILD_COMMIT` | `build.commit` | Git SHA. Set by CI. | No |
| `BUILD_VERSION` | `build.version` | Semver / tag. Set by CI. | No |
| `TURN_SHARED_SECRET` | `turn.shared_secret` | HMAC secret shared with `coturn` for ephemeral creds. **Real secret.** Read from `/etc/communication/turn-secret` (chmod 600) by the systemd unit's `EnvironmentFile=`. | **Yes** |
| `TURN_REALM` | `turn.realm` | TURN realm string. Typically `<IP>.sslip.io`. Public; populated by `install.sh`. | No |
| `TURN_TTL_SECONDS` | `turn.ttl_seconds` | Credential TTL. Bounded `[60, 43200]`. | No |
| `TLS_ENABLED` | `server.tls.enabled` | Whether Fastify terminates TLS itself (true in production behind HAProxy). | No |
| `TLS_CERT_PATH` | `server.tls.cert_path` | PEM cert path (Let's Encrypt SAN). | No |
| `TLS_KEY_PATH` | `server.tls.key_path` | PEM key path (Let's Encrypt SAN). | No |
| `EDGE_HAPROXY_ENABLED` | `edge.haproxy_enabled` | Toggles the HAProxy-front mode hint (informational; the actual port choice is `server.port`). | No |

**`TURN_SHARED_SECRET` is the first real secret in this server.** It is the
concrete instance the §8.6 secrets seam was designed around. The systemd
unit (M19) sources it via `EnvironmentFile=/etc/communication/turn-secret`,
which is `chmod 600` and owned by the `communication` user. Neither the
secret value nor a path that contains it ever appears in the repo,
container image, or `.toml` files.

The other env vars above (`TURN_REALM`, `TURN_TTL_SECONDS`, `TLS_*`,
`EDGE_HAPROXY_ENABLED`) are public configuration — written by `install.sh`
into per-environment TOML or systemd `Environment=` lines, not secrets.

### 8.5 Loading & Validation — `infrastructure/load-config.ts`

Flow:

1. `node-config` is imported once. The package, on first access to its
   `config.util.toObject()` method, walks `apps/communication/config/`,
   merges `default.toml` -> `<NODE_CONFIG_ENV>.toml` -> `local.toml` ->
   env-var overrides per the JSON map.
2. `loadConfig()` calls `config.util.toObject()` and hands the resulting
   plain JS object to `parseServerConfig` (zod, from
   `domain/IServerConfig.ts`).
3. On zod success, returns a typed `IServerConfig`. The composition root
   (`main.ts`) holds this value and passes it (or its slices) into
   constructors.
4. On zod failure, throws `ConfigValidationError` with a multi-line error
   listing each `path[]`, the source layer (file or env-var) that
   produced the offending value, and the env var that can override it.
   The source layer is captured via `node-config`'s
   `config.util.getConfigSources()` (M21). Sample message line:
   `auth.google_oauth_client_id = "" (from production.toml; override
   with GOOGLE_OAUTH_CLIENT_ID env var)`. `main.ts` catches the error,
   logs it, and exits with code `1`. **Fail fast** — we never start a
   half-configured server.

5. **Production-vs-dev guard (m2):** after merging, if
   `resolvedEnv === 'development' && process.env.NODE_ENV === 'production'`
   the loader throws `ConfigValidationError('refusing to start:
   development config in production NODE_ENV')`. Forces operators to set
   `NODE_CONFIG_ENV` explicitly when running production binaries.

6. **Production CORS guard (m8):** when `NODE_CONFIG_ENV === 'production'`,
   `ServerConfigSchema.refine()` requires `cors_allowed_origins.length > 0`
   AND rejects the literal `["*"]` value. Production deploys cannot
   accidentally accept any origin.

Sister entry point used by tests and integration harnesses:
`loadConfigFromObject(raw: unknown): IServerConfig` — the same zod
validation, no filesystem, no `node-config` singleton. Tests build a
literal object and feed it in, so the test suite is independent of the
filesystem layout and can run in parallel.

The zod schema (`ServerConfigSchema`) lives in `domain/IServerConfig.ts`
because it encodes the contract every layer depends on. Brand types
(`Milliseconds` for `response_gather_timeout_ms` etc.) are applied via
`z.number().positive().transform(...)`. `cors_allowed_origins` is
`z.array(z.string())`; an empty array in production paired with no
overriding env var is allowed only if a non-empty allowlist is supplied
through the `CORS_ALLOWED_ORIGINS` env var — but in v1 we keep the
allowlist purely in TOML (it is not on the env-var map). Operations teams
who need a runtime override can either edit `production.toml` for the
deploy or add a `local.toml` to the deploy host (gitignored). See §8.6.

### 8.6 Secrets Handling

In v1, **no real secrets exist.** The only env-mapped value that *might*
look like one is `GOOGLE_OAUTH_CLIENT_ID`, which is a **public identifier**
already embedded in the SPA bundle — committing it to `development.toml`
or `production.toml` is acceptable. We still expose it via the env-var map
so different deploys can target different OAuth clients without rebuilding.

The seam for future secrets is `custom-environment-variables.json`.
Tomorrow we can add `[redis] url = ""` to `default.toml` and a
`"redis": { "url": "REDIS_URL" }` entry to the JSON map without touching
any code outside `domain/IServerConfig.ts` (to extend the schema) and
`load-config.test.ts` (to assert the new override).

For per-host overrides without committing to git, a deploy may drop a
`production.local.toml` (or `local.toml`) onto the host and `node-config`
will pick it up automatically — this is the recognised `node-config`
pattern for site-specific secrets and we document it as a v2 option in
§13.

### 8.7 Build-Time Injection

`BUILD_ID`, `BUILD_COMMIT`, `BUILD_VERSION` are CI-injected at run-start —
they are env vars in the running container, not values baked into the
image. `load-config.ts` picks them up via `custom-environment-variables.json`
just like any other override; the `/health` endpoint reads them off
`config.build.{id, commit, version}` and surfaces them to operators. If
unset, the `default.toml` value `"unknown"` is returned — handy for local
dev where CI is not involved.

### 8.8 Dockerfile — Config-Layer Requirements

The multi-stage build (full spec in §8.16) must:
- `COPY apps/communication/config ./apps/communication/config` so the runner
  stage has all four TOML files and the JSON env-map present at runtime.
- Set `ENV NODE_CONFIG_ENV=production` and `ENV NODE_CONFIG_DIR=/app/config`
  in the runner stage.
- NOT copy `local.toml` (the file is gitignored and not present in the
  build context anyway).
- Continue to set `ENV NODE_ENV=production` (Fastify + pino).
- The runner-stage entrypoint becomes `CMD ["node", "dist/main.js"]`; on
  start, `load-config.ts` sees `NODE_CONFIG_ENV=production`, merges
  `default.toml` + `production.toml` + env-vars, validates, and proceeds.

### 8.9 `.gitignore` Additions

Add the following to the repo-root `.gitignore` (or a new
`apps/communication/.gitignore`, whichever convention the repo prefers):

```
apps/communication/config/local.toml
```

We deliberately do NOT commit a sample `local.toml`. A developer who
needs one creates it themselves; `default.toml` + `development.toml`
already work out of the box for `pnpm dev`.

### 8.10 `tsconfig.json` (strict, node, **no project references**)

`apps/communication/tsconfig.json`:
```json
{
  "extends": "@frozik/typescript-config/node",
  "compilerOptions": {
    "types": ["node"],
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.tsbuildinfo"
  },
  "include": ["src/**/*.ts"]
}
```

`apps/communication/tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.build.tsbuildinfo"
  }
}
```

**Project references — decision:** **No.** `apps/portfolio` does NOT use
project references to `libs/utils` (verified). The pnpm workspace +
`paths` resolution is enough. We follow `apps/signaling`'s pattern exactly.

### 8.11 `moon.yml`

```yaml
language: typescript
layer: application
stack: backend

tags:
  - application

fileGroups:
  sources:
    - 'src/**/*'
    - 'config/**/*'

tasks:
  build:
    command: 'pnpm run build'
    inputs:
      - '@group(sources)'
      - 'tsconfig.json'
      - 'tsconfig.build.json'
    outputs:
      - 'dist'
    options:
      runInCI: true

  dev:
    command: 'pnpm run dev'
    options:
      persistent: true

  type-check:
    command: 'pnpm run types'
    inputs:
      - '@group(sources)'
      - 'tsconfig.json'
    options:
      runInCI: true

  madge:
    command: 'madge src --circular --extensions ts ./src'
```

`config/**/*` is added to `fileGroups.sources` so Moon's incremental cache
invalidates a build when a TOML file changes.

### 8.12 `package.json`

```json
{
  "name": "@frozik/communication",
  "version": "1.0.0",
  "private": true,
  "description": "Socket.IO command/response relay server (OIDC-authenticated)",
  "type": "module",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "NODE_CONFIG_DIR=./config NODE_CONFIG_ENV=development node --watch --experimental-strip-types src/main.ts",
    "start": "NODE_CONFIG_DIR=./config NODE_CONFIG_ENV=production node dist/main.js",
    "types": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "server:install": "bash scripts/install.sh",
    "server:upgrade": "bash scripts/upgrade.sh"
  },
  "dependencies": {
    "@frozik/utils": "workspace:*"
  },
  "devDependencies": {
    "@frozik/typescript-config": "workspace:*"
  }
}
```

The `dev` and `start` scripts set `NODE_CONFIG_DIR` and `NODE_CONFIG_ENV`
explicitly. CI may override `NODE_CONFIG_ENV` to `test` for the test job.

`server:install` and `server:upgrade` are deliberately namespaced — npm
and pnpm both treat the bare name `install` as a lifecycle hook
(`preinstall` / `install` / `postinstall`), so adding `"install"` to
`scripts` would invoke the shell script every time anyone runs
`pnpm install` in the monorepo. The `server:` prefix sidesteps that and
keeps these strictly opt-in operator commands. They are intended to be
run as root on the deploy host:

```
sudo pnpm --filter @frozik/communication run server:install   # first time
sudo pnpm --filter @frozik/communication run server:upgrade   # subsequent updates
```

The shell scripts themselves (`scripts/install.sh`, `scripts/upgrade.sh`)
remain directly invokable too — see §7.2 for the per-file purpose. The
package.json wrappers exist purely for discoverability via `pnpm run`
and to keep a single named entry point per app command.

### 8.13 Where do `fastify`, `socket.io`, `zod`, `jose`, `config`, `toml` Live?

**Decision: in the root `package.json` `dependencies`.**

CLAUDE.md is explicit: *"All runtime dependencies are declared in the root
package.json."* The reason given is to *"prevent version conflicts between
packages in the monorepo — pnpm hoists a single copy and all workspaces
resolve to it."*

The user's worry — *"server-only deps in root would bloat the browser
bundle build"* — is answered by Vite's tree-shaking model. Vite walks the
import graph from `apps/portfolio/src/main.tsx` outward and only emits
modules actually reached. The browser code never imports `fastify`,
`socket.io`, `jose`, or `config`/`toml`, so none of those show up in
`apps/portfolio/dist`. This is already empirically true for `ws` (root
dep, used only by signaling — verified absent from `bundle-stats.html`).

Note on `zod`: zod *may* legitimately ship to the browser if portfolio
later adopts it (it is now the repo-wide standard). The §14 bundle-hygiene
verification therefore asserts only that the **server-only** deps stay
out — `fastify`, `socket.io`, `engine.io`, `socket.io-parser`, `jose`,
`config`, `toml`.

**Net additions to root `package.json` (latest stable major picked at
install time — versions intentionally not pinned in this plan):**
- `dependencies`: `fastify`, `socket.io`, `zod`, `jose`, `config`,
  `toml`, `@fastify/rate-limit` (M11), `prom-client` (M17).
- `devDependencies`: `socket.io-client`, `pino-pretty` (dev-only),
  `@types/config`.

### 8.14 Biome Config

Add one item to the root `biome.json` `overrides` array, mirroring the
existing `apps/signaling/src/**` block:

```json
{
  "includes": ["apps/communication/src/**"],
  "linter": {
    "rules": {
      "suspicious": {
        "noConsole": "off"
      }
    }
  }
}
```

Server logs are pino, but `bootstrap.ts` may need a `console.error`
for last-chance startup failures (before pino is alive). Same trade-off
as signaling.

We will *not* extend `noRestrictedImports` further at this stage. Layer
violations are caught by review + `madge` + a domain-level test that
imports the `domain/` and `application/` trees and asserts no transitive
`socket.io`, `jose`, `fastify`, or `config` (the `node-config` package)
symbols leak in.

### 8.15 Vitest Config

**Decision: re-use the root `vitest.config.ts`** with per-file
environment overrides.

Server tests add `// @vitest-environment node` at the top of every
`*.test.ts` and `*.integration.test.ts` file. Vitest 4 supports per-file
environment overrides.

Config-loader tests use `loadConfigFromObject(raw)` (the in-memory
factory) so they do not depend on the filesystem layout, on
`NODE_CONFIG_ENV`, or on the `node-config` singleton's module-load order.
Two separate test files exercise the filesystem path:
`load-config.test.ts` points `node-config` at a fixture directory under
`__fixtures__/config/` via `NODE_CONFIG_DIR` set before module-import,
covering the layered-merge correctness. Each such test runs in an isolated
`vitest` worker (Vitest's default) — we explicitly do NOT share `config`
state across tests.

### 8.16 Dockerfile

Multi-stage, ~30 lines. Stages:

1. **`builder`**: `FROM node:22-alpine`. `RUN corepack enable && corepack
   prepare pnpm@10.14.0 --activate`. `COPY pnpm-lock.yaml package.json
   pnpm-workspace.yaml ./`. `COPY apps/communication ./apps/communication`
   (this also brings `apps/communication/config/*.toml` and
   `custom-environment-variables.json` into the image). `COPY libs ./libs`.
   `RUN pnpm install --frozen-lockfile --filter @frozik/communication...`.
   `RUN pnpm --filter @frozik/communication run build`.
2. **`runner`**: `FROM node:22-alpine`. `RUN addgroup -S app && adduser
   -S app -G app`. `WORKDIR /app`. `COPY --from=builder
   /build/apps/communication/dist ./dist`. `COPY --from=builder
   /build/apps/communication/config ./config`. `COPY --from=builder
   /build/apps/communication/package.json ./`. `COPY --from=builder
   /build/node_modules ./node_modules`. `USER app`. `EXPOSE 4445`.
   `ENV NODE_ENV=production`. `ENV NODE_CONFIG_ENV=production`.
   `ENV NODE_CONFIG_DIR=/app/config`.
   **`HEALTHCHECK` (M20):**
   ```
   HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
     CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4445)+'/health/live',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
   ```
   This targets `/health/live` (M16) — the liveness probe never reads
   downstream state. Operators can additionally probe `/health/ready` from
   the orchestrator when wiring up the load balancer.
   `CMD ["node", "dist/main.js"]`.

   **Recommended runtime hardening (M20):** the Dockerfile is
   tmpfs-friendly and the operator should run it with
   `docker run --read-only --tmpfs /tmp ...` so the container filesystem
   is immutable apart from `/tmp`.

Notes:
- `--filter ...@frozik/communication...` (with the trailing `...`) installs
  only deps needed for communication, halving the build context.
- We copy the whole hoisted `node_modules`; pnpm's hoisting model means
  deps live in the root, and Node's `require` traversal will find them.
- A `.dockerignore` at repo root must exclude `apps/portfolio/dist`,
  `apps/portfolio/dev-dist`, `apps/portfolio/bundle-stats.html`,
  `apps/portfolio/node_modules`, `**/coverage`, `**/.moon/cache`, `**/dist`,
  and `apps/communication/config/local.toml`.
- **No new system deps required.** `jose` and `node-config` are pure JS;
  no native compilation needed in the builder stage.

### 8.17 Root Build Pipeline Wiring

**Decision (user-confirmed):** the root `pnpm build` includes
`apps/communication`.

Concrete change: the root `moon.yml` `build` task currently runs only
`portfolio:build`. Update it to fan out to all `tag: application` projects
(`moon run \#application:build`) so that `pnpm build` builds both portfolio
and communication. Equivalently, the root `package.json` `build` script can
chain `moon run portfolio:build && moon run communication:build` until the
tag-fan-out is wired. The implementation step lands as its own §14 entry
so it can be reviewed in isolation.

---

## 9. Testing Strategy

### 9.1 Unit Tests — `domain/` and `application/`

100% pure-TS, no socket.io, no network, no fakes for transport beyond
hand-written narrow fakes (M18 — one per port):
`FakeCommandTransport` (implements `ICommandTransport`, used by
`CommandRouter.test`), `FakePresenceTransport` (used by
`PresenceBroadcaster.test`), `FakeSignalTransport` (used by
`SignalRelay.test`), `FakeLifecycleTransport` (used by
`ConnectionLifecycle.test` for `disconnect` /
`emitTokenExpiring` / `emitTokenExpired` / `emitDraining`
assertions). Each fake exposes a recordable call log scoped to its
single concern. Targets:

- **`Room.test.ts`** — `addMember` respects `max_listeners` cap;
  `addMember` rejects with `RoomFullError { reason: 'too-many-tabs' }`
  when the same `userId` is already present `max_tabs_per_user` times
  (m3); identity is stored; `everyOther` excludes self; `count()`
  is consistent; double-add is idempotent (overwrites identity);
  double-remove is idempotent; `getUsers()` returns identities
  deduplicated by `userId` (multi-tab — see §13).
- **`InMemoryRoomRegistry.test.ts`** — rooms created on demand,
  `release` removes the room when the last member leaves, `size` and
  `totalMembers` accurate.
- **`protocol-validators.test.ts`** — valid handshake `auth` accepted,
  empty `displayName` rejected with `auth/missing-fields`, oversized
  `displayName` rejected, garbage UUID rejected, well-formed payloads
  return branded `Opaque` types. Auth-event schemas accept valid shapes
  and reject malformed ones. `IServerDrainingEvent` schema accepts `{}`.
- **`ConnectionLifecycle.test.ts`** (M24 — covers handshake + refresh
  + disconnect; replaces the previous `AuthHandshakeUseCase.test.ts`
  + `RefreshTokenUseCase.test.ts`):
  - **`onHandshake` happy path** returns `{ identity, claims, roomId }`;
  - verifier returning each `AuthErrorCode` propagates that error;
  - invalid handshake shape (missing fields, bad displayName) yields
    `auth/missing-fields` without ever calling the verifier;
  - cap-reached propagates `RoomFullError` (`'too-many-listeners'` and
    `'too-many-tabs'` variants);
  - **`onRefresh` happy path** replaces claims and returns
    `{ ok: true, expiresAt }`; verifier failure returns
    `{ ok: false, error }` and does NOT disconnect (assert no
    `transport.disconnect` call);
  - **M10 binding (sub-mismatch)** — refresh with new `sub` differing →
    `{ ok: false, error: 'auth/sub-mismatch' }`, no claim replacement;
  - **M10 binding (iat regression)** — refresh with `iat <= existing`
    → `{ ok: false, error: 'auth/invalid-token' }`;
  - **M10 binding (sid mismatch)** — refresh with new `sid` differing
    → `{ ok: false, error: 'auth/invalid-token' }`;
  - **`onDisconnect`** disarms TokenLifecycle, removes from room,
    broadcasts presence, cancels in-flight `routeInitiate`.
- **`TokenLifecycle.test.ts`** (M23 — `vi.useFakeTimers()` +
  `vi.setSystemTime()`, no fake clock/scheduler abstraction):
  - `arm` with `exp = now + 600s` schedules warning at `t = 540s` and
    expiry at `t = 600s`;
  - `vi.advanceTimersByTime(540_000)` triggers `onWarning` exactly once
    with `secondsRemaining: 60`;
  - `vi.advanceTimersByTime(60_000)` triggers `onExpired` exactly once;
  - `disarm` cancels both timers; no callbacks fire after disarm;
  - `replaceClaims` cancels and re-schedules with the new `exp`;
  - **M6 stale generation** — schedule warning, then `replaceClaims`,
    then advance time past the original warning fire-time → original
    callback bails silently; only the new generation fires;
  - edge case: claims whose `exp - warningSeconds` is already in the
    past triggers `onWarning` synchronously (covered by an explicit
    branch — no negative-delay `setTimeout` calls).
- **`CommandRouter.test.ts`** — given a `FakeCommandTransport` (M18) that yields
  `[ok(R1), timeout(R2), disconnected(R3)]`, the router emits three
  `command:response` events with correct `kind` and `responder`
  populated from the `Room`. Aborting the initiator signal mid-stream
  halts further emits.
  - **C2 — late-ack drop:** a transport that yields `timeout(R2)` then
    later yields `ok(R2)` produces exactly ONE `command:response` (the
    timeout); the late ack is dropped at `debug`. Asserted by spying
    on `transport.emitResponse`.
  - **M2 — abort cancellation:** caller passes an `AbortSignal`; firing
    it mid-stream stops further `emitResponse` calls.
  - **M3 — concurrent same-correlation initiates:** same socket sends
    two `command:initiate` events with the same `correlationId`; both
    ack independently and both fan out (no internal collision)
    because the per-socket `dispatchInstanceId` differs.
  - **M5 — multi-tab no-dedup:** Room has `userId=U` connected via
    sockets `S1` and `S2`; a single `command:initiate` from a third
    socket emits `command:execute` to BOTH S1 and S2; the router
    forwards BOTH `command:response` events back to the initiator
    with `responder.userId === U`. Pins the contract — server does
    not dedup.
  - **M8 — back-pressure:** a socket with 32 in-flight initiates
    receives `kind: 'dispatch-rejected', reason: 'too-many-in-flight'`
    on the 33rd; counter decrements correctly as correlations settle.
  - **C3 — Identity snapshot survives mid-flight removal:** during
    fanout, `Room.removeMember(R2)` is called; the resulting timeout
    `command:response` still carries the correct `responder.userId`
    (snapshot taken at fanout start).
- **`PresenceBroadcaster.test.ts`** — `onJoin`/`onLeave` produce
  `room:presence` payloads with both `socketCount` and `users[]`
  populated.
- **`hashUserId.test.ts`** (M12) — deterministic 16-hex-char output;
  different `userId` → different hash; helper does not leak the raw
  `userId` (the function returns only the hash, no debugging field).
- **`load-config.test.ts`** — exercises the loader without touching
  the `node-config` global except in two narrow filesystem-merge
  tests (those tests use a `__fixtures__/config/` dir and set
  `NODE_CONFIG_DIR` before requiring the module). Asserts:
  - `loadConfigFromObject(validRaw)` returns a typed `IServerConfig`;
  - missing required field (e.g. empty `auth.google_oauth_client_id`)
    throws `ConfigValidationError` listing the path, the source layer
    (via `config.util.getConfigSources()`, M21), AND the env-var
    name `GOOGLE_OAUTH_CLIENT_ID`;
  - invalid type (string where number expected, etc.) throws
    `ConfigValidationError` with a clear path;
  - filesystem layered merge: `default.toml` + `test.toml` produces
    the expected merged object;
  - env-var override beats TOML: setting `process.env.LOG_LEVEL='debug'`
    before requiring the module wins over `default.toml`'s `"info"`;
  - **m2 production-vs-dev guard:** `NODE_CONFIG_ENV=development`
    with `NODE_ENV=production` throws `ConfigValidationError`.
- **`IServerConfig.test.ts`** (zod schema only — no filesystem):
  schema accepts a fully-populated valid object; rejects each
  required-field-missing case; rejects negative or zero numerics for
  `port`, `response_gather_timeout_ms`, etc.; brands `Milliseconds`
  fields correctly. **m8 production-CORS refine:** with
  `NODE_CONFIG_ENV=production` (mocked), schema rejects empty
  `cors_allowed_origins` and rejects `["*"]`. **TURN refines:**
  empty `turn.shared_secret` with `turn.enabled = true` AND
  `NODE_CONFIG_ENV=production` is rejected; `turn.ttl_seconds` outside
  `[60, 43200]` is rejected; valid bounds accepted.
- **`SignalRelay.test.ts`** (m13 — fakes:
  `FakeSignalTransport` (one method: `broadcastSignalEvent`),
  `FakeAuditLogger`, `FakeServerLogger`, in-memory `IRoomRegistry`):
  - happy-path publish with `recipientCount = 3` (room has 4 sockets,
    publisher excluded) returns `{ ok: true, recipientCount: 3 }` —
    confirms the m5 `room.size - 1` semantic;
  - the transport is asked to broadcast a `signal:event` containing
    the unmodified payload + `from: identity` (incl. `socketId`, M3)
    + the original `correlationId` (passed through unchanged, m3);
  - publishing more than `maxPublishPerSecond` (M1 — default 100)
    from one socket within one second returns
    `{ ok: false, error: 'rate-limited' }` and the transport is NOT
    called for the rejected attempts;
  - waiting one second refills the bucket via
    `vi.advanceTimersByTime(1000)`;
  - publish to a missing room (race with disconnect) returns
    `{ ok: false, error: 'not-in-room' }` (m2) and logs at `warn`;
  - oversize payload (`payloadBytes > maxPayloadBytes`) returns
    `{ ok: false, error: 'payload-too-large' }` (m1);
  - null payload returns `{ ok: false, error: 'invalid-payload' }`
    (m1);
  - the inner `payload` is not parsed or modified — pass an arbitrary
    object/string/number/buffer-like and assert the broadcasted
    `payload` is `===` reference-equal to the input.
- **`IssueTurnCredentialsUseCase.test.ts`** (m13 — deterministic
  fixture per consilium recommendation):
  - input `{ sharedSecret: 'test-secret', userId: 'user-123' as
    UserId, nowEpochMs: 1_700_000_000_000, ttlSeconds: 3600, urls:
    ['turns:turn.example:5349?transport=tcp'] }`;
  - asserts exact `username === '1700003600:<hashUserId("user-123")>'`
    (the hash is precomputed; the test stores both expected strings
    as constants);
  - asserts `credential` against a hand-computed reference HMAC value
    derived via `printf '%s' "<username>" | openssl dgst -sha1 -hmac
    "test-secret" -binary | base64` (the openssl one-liner is in a
    comment); pins the M5 secret-first arg order;
  - asserts `ttl === 3600` and `urls === input.urls`;
  - empty `sharedSecret` triggers `assert(...)` and returns
    `{ ok: false, error: 'internal' }`;
  - changing any single input changes the credential (sanity).

### 9.2 Integration Tests — `infrastructure/` and `presentation/`

Use the real `socket.io-client` against a real server instance bound to
an ephemeral port (`port: 0`). Each test:
1. Calls `createServer({ config, verifier, clock, scheduler })`.
2. `await app.listen({ port: 0 })`.
3. Reads the actual port: `const port = (app.server.address() as
   AddressInfo).port`.
4. Opens 1..N `socket.io-client` connections.
5. Asserts protocol behaviour end to end.
6. `await app.close()` in `afterEach`.

**Test files** (m13 — every `*.integration.test.ts` opens with a one-line
comment stating which deps are real and which are stubbed, e.g.
`// Integration test — real Socket.IO + Fastify; stubbed IIdentityVerifier; in-memory IRoomRegistry.`):

- **`SocketIORoomTransport.integration.test.ts`**
  `// Integration test — real Socket.IO + Fastify; in-memory IRoomRegistry.`
  Given a real server, `broadcastRequest` reaches every other client,
  respects timeout, surfaces disconnects. **C1 — manual fanout:**
  responses arrive individually as they settle, NOT as a single batched
  array (asserted by the inter-arrival timing). **M2 — abort:**
  triggering the supplied `AbortSignal` mid-stream stops further
  `emitResponse` invocations on the wire.
- **`GoogleIdentityVerifier.integration.test.ts`**
  `// Integration test — real jose verification against an in-memory JWKS HTTP server; local RSA keypair.`
  Generates a local RSA keypair via `jose.generateKeyPair`, exports JWK
  via `jose.exportJWK`, starts a tiny in-memory HTTP server that serves
  `{ keys: [...] }` at `/oauth2/v3/certs`, points the verifier at that
  URL (via constructor-injected JWKS URL — overridable in tests), signs
  ID tokens via `jose.SignJWT`. Exercises:
  - happy path with valid `iss`, `aud`, `exp` -> `Result.ok`;
  - tampered signature -> `auth/invalid-token`;
  - past `exp` -> `auth/expired-token`;
  - wrong `aud` -> `auth/wrong-audience`;
  - wrong `iss` -> `auth/wrong-issuer`;
  - JWKS server unreachable -> `auth/jwks-unreachable`;
  - **C4 — token signed with HS256** (using a symmetric key built
    from the public key bytes) → `auth/invalid-token`. Pins the
    `algorithms: ['RS256']` enforcement;
  - **C4 — token with `alg: 'none'`** → `auth/invalid-token`;
  - **M9 — `azp` mismatch** → `auth/wrong-audience`;
  - **M13 — `name` claim absent** → `auth/missing-name-claim` (token
    is otherwise valid; no email cascade);
  - **m1 — clock-tolerance override:** verifier with
    `clock_tolerance_seconds=0` rejects a token whose `exp` is 2 s in
    the past; with `clock_tolerance_seconds=5` it accepts it.
- **`bootstrap.integration.test.ts`**
  `// Integration test — real Socket.IO + Fastify; stubbed IIdentityVerifier; in-memory IRoomRegistry; vi.useFakeTimers for time-based assertions.`
  Boots the full server with a **stub `IIdentityVerifier`** (the
  unit-level integration: we trust the Google verifier integration test
  above for `jose` correctness). Tests:
  - `GET /health/live` returns 200 with `{ status: 'ok', uptimeSeconds }`;
  - `GET /health/ready` returns 200 when JWKS healthy and not draining;
  - **M16 — `/health/ready` 503 when JWKS unhealthy:** stub
    `IVerifierHealth` to report 5 consecutive failures → endpoint
    returns 503 with `{ jwks: { consecutiveFailures: 5 } }`;
  - CORS headers reflect the allowlist;
  - happy-path initiate -> response cycle through the public Socket.IO
    API; both initiator and responder identities visible in `users[]`
    and `responder` payload;
  - room-full rejection produces `connect_error` with
    `code: 'ROOM_FULL'`;
  - bad token rejection produces `connect_error` with
    `code: 'auth/invalid-token'`;
  - **M15 — error opacity:** `connect_error.message` does NOT contain
    `jose`, `JWS`, or `JWK` strings (asserted via regex);
  - token-expiring + refresh-success flow with `vi.useFakeTimers()`
    (M23) so we can fast-forward time;
  - token-expired flow with no refresh disconnects the socket and emits
    `room:presence` to remaining users;
  - refresh with an invalid token yields `{ ok: false, error }` ack and
    leaves the connection alive (assert no disconnect event observed);
  - **M18 — draining:** invoking the close handler emits `server:draining`
    to all rooms and flips `/health/ready` to 503; in-flight
    `command:initiate` correlations are allowed to settle within the
    `shutdown_grace_ms` window.
- **`bootstrap.rate-limit.integration.test.ts`** (M11)
  `// Integration test — real @fastify/rate-limit on the upgrade route; stubbed IIdentityVerifier; PROXY proto v2 client wrapper for original-IP simulation.`
  - exceeding `security.handshake_rate_per_ip_per_minute` from one IP
    produces `connect_error { code: 'auth/rate-limited' }`;
  - per-IP failed-handshake counter — N+1 successive failed handshakes
    from one IP within the sliding window blocks subsequent attempts
    for `failed_handshake_block_seconds` with `auth/rate-limited`;
  - successful handshake clears the per-IP counter;
  - **PROXY proto v2 (C1):** with the wrapper enabled, two requests
    sourced from different original IPs (simulated via PROXY headers)
    are accounted separately; without the wrapper they would both
    appear from `127.0.0.1` and be conflated. New metric
    `communication_proxy_protocol_parse_failure_total` increments on
    a malformed PROXY header.
- **`bootstrap.signal.integration.test.ts`**
  `// Integration test — real Socket.IO + Fastify; stubbed IIdentityVerifier; in-memory IRoomRegistry.`
  - two clients (Alice, Bob) join the same room via stubbed verifier;
  - Alice emits `signal:publish` with `{ payload: { sdp: 'v=0\r\n...' },
    correlationId: 'c1' }`;
  - Bob receives `signal:event` with the unmodified `payload`,
    `from: { userId: '<alice-sub>', displayName: 'Alice' }`,
    `correlationId: 'c1'`;
  - Alice's ack is `{ ok: true, recipientCount: 1 }`;
  - **publisher excluded:** Alice does NOT receive a `signal:event`
    echo (asserted by listening on the publisher socket);
  - **third client joins late:** a third socket Carol joins after
    Alice's first publish; Alice's second publish reaches BOTH Bob and
    Carol (recipientCount: 2);
  - **multi-tab no dedup (6.Y.2):** Bob has two tabs in the room; one
    Alice publish produces `signal:event` on BOTH Bob tabs;
  - **rate limit (6.Y.4 — M1):** Alice publishing 201 times within 1
    second receives `{ ok: false, error: 'rate-limited' }` for the
    201st attempt; Bob received only 200 events. (Refill rate
    `max_publish_per_second_per_socket = 100`; burst
    `max_publish_burst = 200`.)
  - **`from.socketId` (M3):** the `signal:event` `from` carries the
    server-issued UUID `socketId`, distinct from Socket.IO's internal
    `socket.id`. Asserted by Bob receiving two events from Alice's
    two tabs with different `from.socketId`.
  - **payload-too-large (m1):** Alice publishes a 32 KiB payload;
    ack `{ ok: false, error: 'payload-too-large' }`.
  - **invalid-payload (m1):** Alice publishes `null`; ack
    `{ ok: false, error: 'invalid-payload' }`.
- **`bootstrap.turn.integration.test.ts`**
  `// Integration test — real Socket.IO + Fastify; stubbed IIdentityVerifier; deterministic config { shared_secret: 'fixture-secret', ttl_seconds: 3600, urls: [...] }; vi.setSystemTime() for HMAC reproducibility.`
  - authenticated client emits `turn:request-credentials`;
  - ack contains `{ username, credential, ttl, urls }`;
  - `username` matches `^\d+:[0-9a-f]{16}$`;
  - `credential` decodes to 20 bytes (SHA-1 output);
  - the HMAC is reproducible: re-computing
    `base64(hmacSha1(username, 'fixture-secret'))` matches the ack;
  - `ttl === 3600`; `urls === config.turn.urls`;
  - **rate limit (M7):** the same socket emitting
    `turn:request-credentials` 6 times within 1 minute → 6th attempt
    acks `{ ok: false, error: 'rate-limited' }`; connection stays
    alive.
  - **`turn.enabled = false`:** no handler is registered; emitting
    `turn:request-credentials` from the client times out at the
    Socket.IO ack layer (no server-side error).

Each integration test file starts with `// @vitest-environment node`.

### 9.3 What We Are NOT Testing in v1

- Cross-process behaviour (single Node only).
- Actual TLS termination (handled by reverse proxy / PaaS).
- Long-polling fallback (default Socket.IO transport coverage is fine).
- Concurrency under thousands of rooms (load testing is §13 deferred).
- Real Google JWKS (the integration test mocks JWKS locally; a smoke test
  against real Google can be added in v2 if useful).

---

## 10. Error Handling & Edge Cases

| Case | Behaviour | Justification |
|---|---|---|
| Invalid UUID in handshake | `connect_error { code: 'INVALID_ROOM_ID' }`. Socket never joins. | Fail fast at the door — no resource consumed. |
| Missing / empty `idToken` or `displayName` | `connect_error { code: 'auth/missing-fields' }`. | Zod parses raw `auth` and rejects missing fields before any verifier call. |
| Invalid JWT signature / malformed JWT | `connect_error { code: 'auth/invalid-token' }`. | Stops forged tokens at the door. |
| Expired JWT at handshake | `connect_error { code: 'auth/expired-token' }`. | Clear, actionable error for the client. |
| Wrong `aud` | `connect_error { code: 'auth/wrong-audience' }`. | Defeats forged-but-validly-signed tokens issued for a different OAuth client. |
| Wrong `iss` | `connect_error { code: 'auth/wrong-issuer' }`. | Defeats Google-impersonation via other issuers. |
| JWKS unreachable at handshake | `connect_error { code: 'auth/jwks-unreachable' }`. **Connection refused.** | Decision: **fail-closed**. The trade-off — accepting a connection while we cannot verify is silently allowing forged tokens through during JWKS outages. `jose` caches JWKS and refreshes on miss; an actual outage is rare. Surfacing the error to the client lets them retry. |
| Room overflow (51st client) | `connect_error { code: 'ROOM_FULL', maxListeners: 50 }`. | Hard cap. |
| Initiator disconnects mid-broadcast | All pending response forwards aborted via `AbortController`. No further emits. No retries. | Initiator left. |
| Responder times out | Server emits `command:response { kind: 'timeout', correlationId, timedOutAfterMs: 10000, responder }` to initiator. | The user spec asked for a decision: **forward partial + timeout marker.** Silent drop would leave the initiator hanging. A typed marker lets the client UI render "Bob: didn't answer". |
| Responder disconnects mid-flight | Server emits `command:response { kind: 'responder-disconnected', correlationId, responder }`. | Same reasoning as timeout. |
| Token expires while connection active | `auth:token-expiring` at `exp - 60s`; `auth:token-expired` at `exp`; socket disconnected with reason `auth/expired`; `presenceBroadcaster.onLeave` emits to remaining users. | Bounded liveness — a handshake-validated token cannot give an unlimited connection. |
| `auth:refresh-token` with valid token | Lifecycle re-armed; ack `{ ok: true, expiresAt }`. | Smooth UX — client refreshes silently and stays connected. |
| `auth:refresh-token` with invalid token | Ack `{ ok: false, error: <AuthErrorCode> }`. **NOT disconnected.** | Decision: the previous (still-valid) token entitles them to remain. The bad refresh is a recoverable client error (e.g. they tried with a stale handle). Disconnecting would punish a transient mistake. |
| `displayName` empty / > 50 chars | `connect_error { code: 'auth/missing-fields' }`. | Zod rejects at handshake. |
| Token signed validly by Google but missing the `name` claim | `connect_error { code: 'auth/missing-name-claim' }`. | Server uses ONLY `claims.name` to derive `displayName` — no `email` cascade (privacy: broadcasting email to room participants leaks identity). Client must request `profile` scope. Fail-closed at handshake. (M13 — supersedes earlier email-cascade decision.) |
| Missing required config key at startup (e.g. empty `auth.google_oauth_client_id` in production) | Process exits with code `1` and a multi-line error: each invalid `path[]` plus the env-var that should set it (e.g. `auth.google_oauth_client_id - set GOOGLE_OAUTH_CLIENT_ID`). | Fail-fast — never start a half-configured server. |
| Same `userId` in two tabs in one room | Both sockets are accepted (subject to `room.max_tabs_per_user`, default 5). `users[]` deduplicates by `userId` (length ≤ socketCount). See §13 and (i) above for client-side dedup of `command:response`. | Variant A confirmed by user — dedup by `userId`. |
| Malformed `command:initiate` payload | Server invokes the ack callback with `{ socketCount: 0, users: [], correlationId: 'invalid' }` *and* logs a warn. Socket NOT disconnected. | A buggy client should not be kicked off; warn is enough until incidents prove otherwise. |
| Malformed `command:execute` ack from a responder | Treated like a timeout: emit `kind: 'timeout'` to initiator. Log warn. | Initiator is still entitled to a settled correlation id. |
| Double-`command:initiate` with same `correlationId` | Server processes both independently. Client owns uniqueness. | Server-side dedup is feature creep. |
| Server SIGTERM (M18) | Two-phase shutdown: (1) refuse new WS upgrades, broadcast `server:draining` to all rooms, flip `/health/ready` to 503; (2) wait up to `server.shutdown_grace_ms` (default 11_000) for in-flight `command:initiate` correlations to settle; (3) `app.close()`, exit 0. systemd `TimeoutStopSec` ≥ `shutdown_grace_ms + 5s`. | Clients reconnect to a different instance during phase 1; in-flight work completes during phase 2. |
| Per-correlation per-responder late ack (C2) | First settle wins (`ok` / `timeout` / `disconnected`); later inputs for the same `(correlationId, responderSocketId)` pair are silently dropped at `debug`. No second `command:response` ever emitted. | State machine `Pending → Settled` with exactly one transition. |
| Initiator over-dispatches (M8) | 33rd in-flight `command:initiate` from one socket acked with `kind: 'dispatch-rejected', reason: 'too-many-in-flight'`. No fanout. | Per-socket back-pressure. |
| Same `userId` 6th tab join (m3) | Handshake rejected with `RoomFullError { reason: 'too-many-tabs' }`. | `room.max_tabs_per_user` cap. |
| IP exceeds handshake rate (M11) | `connect_error { code: 'auth/rate-limited' }`. | `@fastify/rate-limit` on upgrade route + per-IP failed-handshake block. |
| Refresh: new `sub` differs (M10) | Ack `{ ok: false, error: 'auth/sub-mismatch' }`. Connection NOT dropped (existing token still valid). | Identity-binding. |
| Refresh: new `iat <= existing iat` (M10) | Ack `{ ok: false, error: 'auth/invalid-token' }`. | Replay protection. |
| Refresh: existing token has `sid`, new `sid` differs (M10) | Ack `{ ok: false, error: 'auth/invalid-token' }`. | Session-binding. |
| Token validates but `azp` mismatches (M9) | `connect_error { code: 'auth/wrong-audience' }`. | `azp` is the OAuth-spec authorized-party check. |
| Empty `turn.shared_secret` in production at startup | Process exits with code `1` and a multi-line error citing `turn.shared_secret - set TURN_SHARED_SECRET (sourced from /etc/communication/turn-secret)`. | Fail-fast — the secret must be present before issuing any creds. |
| Empty `turn.shared_secret` in dev | `turn:request-credentials` ack returns `{ ok: false, error: 'internal' }` and logs `warn { kind: 'turn-disabled-no-secret' }`. Connection stays alive. | Convenience for local dev — TURN is optional and creds are just unavailable. |
| `signal:publish` over rate limit (6.Y.4) | Ack `{ ok: false, error: 'rate-limited' }`. **Socket NOT disconnected.** | Bursty ICE candidate trickle is normal; disconnecting would punish a healthy WebRTC start-of-call. |
| `signal:publish` against a room the socket is not in | Ack `{ ok: false, error: 'not-in-room' }` (m2 — supersedes `'internal'`), log at `warn`. | Should be impossible (handshake auto-joins exactly one room) — a defensive branch in case of race. |
| `signal:publish` payload exceeds `[signal] max_payload_bytes` (default 16384) | Ack `{ ok: false, error: 'payload-too-large' }`, log at `warn`. | m1 — wire-size cap. Prevents buggy clients from amplifying broadcast traffic. |
| `signal:publish` payload is null / undefined | Ack `{ ok: false, error: 'invalid-payload' }`. | m1 — zod refine rejects empty payloads. |
| `turn:request-credentials` over rate (M7) | Ack `{ ok: false, error: 'rate-limited' }`, log at `warn`. Connection stays alive. | `[turn] credential_requests_per_minute_per_socket = 5` default; bursty re-allocations are abusive without it. |
| TURN HMAC computation throws (`node:crypto` failure) | Ack `{ ok: false, error: 'internal' }`, log `error { kind: 'turn-hmac-failed' }`. Connection stays alive. | `node:crypto` failures here are pathological (e.g. OOM); shielding the socket lifecycle from them is correct. |
| Cert renewal hook fails (M15 — fail-fast, NO `\|\| true`) | `set -eu` aborts the hook on the first failed `systemctl` call; certbot's deploy-hook protocol records non-zero exit and retries on the next run. The communication service continues serving with the OLD (still-valid) cert. A separate cert-expiry systemd timer warns to journald at 7 days remaining (M15). | Let's Encrypt renews ~30 days before expiry; one hook failure has plenty of headroom for a follow-up renewal. Silent `\|\| true` would mask a misconfigured reload and let the cert silently expire. |
| Cert renewal — service drain (M14) | Renewal hook executes `systemctl kill -s SIGTERM communication`, sleeps `shutdown_grace_ms/1000 + 5` seconds, then `systemctl start communication`. Active sessions drain via the M18 `server:draining` broadcast. | Decision: 2-phase drain over zero-drop reload. Every ~60 days, all sessions drop after a graceful drain. Clients reconnect; WebRTC peers re-allocate via `turn:request-credentials`. Zero-drop reload deferred to v2. |
| HAProxy crash | systemd `Restart=always` re-spawns it within seconds. During the gap, port `:443` is unreachable. coturn `:3478` UDP/TCP stay up regardless. | HAProxy is a separate fault domain. |
| coturn crash | systemd `Restart=always` re-spawns. WebRTC peers behind symmetric NAT lose media until restart; signaling continues unaffected. | Sessions can re-allocate via `turn:request-credentials` once coturn returns. |

### 10.1 Schema Validation Library — Decision

**Decision: `zod@^3`. This is now the repository-wide standard for schema validation.**

**Rationale.** The user has decided to make zod the repository standard going
forward. Even though a tree-shaking-first alternative would be ~13× smaller
for our specific schema set and would have been our pick on technical
grounds alone, repo-wide consistency wins — every future feature that needs validation will use zod,
and having two competing schema libs is worse than the bundle cost. Zod's
API is also more familiar to most TS developers, lowering onboarding cost.
The bundle-size impact is irrelevant for this server (no browser bundle);
if portfolio later adopts zod for client-side validation, the marginal
client cost is acceptable in exchange for one shared mental model across
the monorepo.

| Library | Bundle (gz) | API | Tree-shake | Verdict |
|---|---|---|---|---|
| **zod@^3** | ~13 KB | Mature, familiar, big community. | Limited (imports a lot by default). | **Picked — repo-wide standard.** |
| typia | 0 KB runtime | Compile-time codegen, requires TS transformer. | n/a | Too invasive (custom `tsc` invocation). |
| none | 0 KB | Hand-written guards. | n/a | Server takes untrusted input; manual narrowing scales poorly. |

The server takes untrusted JSON over the wire (handshake `auth`,
`command:initiate` payloads, `command:execute` acks, `auth:refresh-token`
payloads). Skipping a schema lib would either litter the code with manual
guards or push validation to consumers — neither is acceptable. zod's
`safeParse` + `infer<typeof Schema>` gives us strict types and clean error
paths.

---

## 11. Observability

### 11.1 Logging

Fastify's built-in pino is the only logger. `PinoServerLogger`
(`infrastructure/`) wraps `app.log` and exposes the `IServerLogger`
port. In `NODE_ENV !== 'production'`, we register `pino-pretty`. In
production, JSON lines.

**Privacy rules (M12):**
- **Never log `userId` plaintext at any level.** Always log
  `userIdHash = sha256(userId).slice(0,16)` via the `hashUserId()`
  helper in `application/`. Pino's `redact` option masks the field
  automatically if it ever leaks into a log object.
- **Never log `email`** at any level.
- **Never log `idToken`** at any level. The handshake `auth.idToken` is
  redacted at the framework level before pino sees the object.
- `displayName` may be logged at `debug` only.
- `REDACTED_PATHS` (passed to pino's `redact`): `['*.userId', '*.email',
  '*.idToken', 'auth.google_oauth_client_id'?]`. Future secrets are added
  here in the same PR that introduces them.

**Events logged:**
- `info` on **server startup** (once): `{ kind: 'config-loaded',
  nodeConfigEnv: process.env.NODE_CONFIG_ENV ?? 'development',
  mergedFiles: ['default.toml', '<env>.toml', 'local.toml'? ],
  configSources: <output of node-config getConfigSources()>,
  config: redact(config, REDACTED_PATHS) }`. The list of merged TOML
  files is enumerated by inspecting which files actually exist in
  `NODE_CONFIG_DIR` at boot.
- `info` on handshake **success**: `{ socketId, roomId, userIdHash,
  transport, ip, userAgent }`. Helps correlate across clients without
  leaking the raw `userId`.
- `warn` on handshake **failure**: `{ kind: 'handshake-failure', code:
  AuthErrorCode | RoomErrorCode, roomId, ip }`. (`userIdHash` not yet
  known.) The original `jose` error message (M15) is logged here at
  `warn` server-side; never propagated to the client.
- `info` on `disconnect`: `{ socketId, roomId, userIdHash, membersAfter,
  reason }` (reason includes `auth/expired` for token-expiry disconnects).
- `info` on `command:initiate`: `{ socketId, roomId, userIdHash, command,
  correlationId, members, payloadBytes }`. **No payload contents.**
- `debug` on late ack (post-settle): `{ socketId, roomId, correlationId,
  responderSocketId, kind: 'late-ack-dropped' }` (C2).
- `info` on `auth:token-expiring` emitted: `{ socketId, userIdHash,
  secondsRemaining }`.
- `warn` on `auth:token-expired` disconnect: `{ socketId, userIdHash, roomId }`.
- `info` on `auth:refresh-token` attempt: `{ socketId, userIdHash,
  ok: boolean, error?: AuthErrorCode }`.
- `warn` on JWKS fetch failure inside `GoogleIdentityVerifier`:
  `{ kind: 'jwks-unreachable', detail, consecutiveFailures }` (M16/m5).
- `warn` on validation failure: `{ socketId, kind: 'invalid-payload',
  errorCode, ... }`.
- `warn` on responder timeout: `{ socketId, roomId, correlationId,
  responderSocketId }`.
- `audit` channel (M4 — `IAuditLogger` port): one JSON line per
  privileged action — `{ event, timestamp, userIdHash, roomId,
  correlationId, command }`. v1 implementation is a thin wrapper around
  pino with a separate `audit:` channel; retention is operator-managed
  via journald rotation (see M19 / §11.4).
- `debug` on `signal:publish` (high-volume — debug level only):
  `{ socketId, roomId, userIdHash, recipientCount, correlationId? }`.
  **Never log payload contents** (opaque blob; may contain ICE
  candidate IPs, SDP fingerprints, etc., even though those are not
  PII per se the rule is uniform "no payload contents").
- `info` on `turn:request-credentials` (rare — info level):
  `{ socketId, roomId, userIdHash, ttl }`. Never log the issued
  `username` or `credential` — they are short-lived but still
  sensitive (anyone with the credential can use TURN bandwidth).
- `info` every 60 s: `{ rooms, totalMembers }`.

### 11.2 Health endpoints (M16)

The server exposes TWO health endpoints — load balancers and orchestrators
can probe each independently:

- **`GET /health/live`** — process responsiveness. Returns `200 OK`
  unconditionally unless the event loop is blocked. Body:
  `{ status: 'ok', uptimeSeconds }`. The Dockerfile `HEALTHCHECK` and
  the systemd unit's liveness probe target this endpoint.
- **`GET /health/ready`** — service readiness. Returns `503 Service
  Unavailable` when ANY of:
  - JWKS has had ≥ 5 consecutive fetch failures within the last 60 s
    (`jwks-degraded`);
  - startup has not completed (`starting`);
  - the server is draining (post-`SIGTERM`, see M18 / §10).
  Body (regardless of status):
  ```json
  {
    "jwks": {
      "lastSuccessAt": "2026-05-09T12:34:56.789Z",
      "lastFailureAt": null,
      "consecutiveFailures": 0
    },
    "build": { "id": "...", "commit": "...", "version": "..." },
    "draining": false
  }
  ```
  Load balancers use `/health/ready` for traffic gating.

`GoogleIdentityVerifier` records JWKS fetch outcomes via the
`IVerifierHealth` port; `/health/ready` reads from that port at request
time. CORS reflects the configured allowlist (Origin matters even for
health endpoints because they expose build metadata).

### 11.3 `/metrics` (M17 — OpenMetrics)

`GET /metrics` returns **OpenMetrics text format** (the
`application/openmetrics-text` content type). The implementation uses
**`prom-client`** (added to root `package.json` `dependencies`) so the
exposition format is faithful and the histograms get correct cumulative
buckets.

**Histograms** (buckets: `0.01, 0.05, 0.1, 0.5, 1, 5, 10` seconds):
- `communication_dispatch_duration_seconds` — full
  `command:initiate` -> ack-to-initiator interval.
- `communication_broadcast_fanout_listeners` — number of responder sockets
  per `command:initiate` (re-purposed bucket set: `0, 1, 2, 5, 10, 25, 50`).
- `communication_auth_handshake_duration_seconds` — middleware wall-clock.
- `communication_jwks_fetch_duration_seconds` — `jose.createRemoteJWKSet`
  fetch time.
- `communication_responder_response_duration_seconds{kind="ok"|"timeout"|"disconnected"}`
  — per-responder latency, labelled by terminal kind.

**Counters:**
- `communication_orphaned_responses_total` — late acks dropped after
  initiator disconnect (M7).
- `communication_auth_handshake_failure_total{code}` — labelled by
  `AuthErrorCode | RoomErrorCode`.
- `communication_token_refresh_total{outcome="ok"|"fail"}`.
- `communication_dispatch_rejected_total{reason}` — currently only
  `reason="too-many-in-flight"` (M8).
- `communication_handshake_rate_limited_total` — increments on every
  `auth/rate-limited` rejection (M11).
- `communication_signal_publish_total{outcome="ok"|"rate-limited"|"not-in-room"|"invalid-payload"|"payload-too-large"|"internal"}`
  — counts every `signal:publish` attempt by terminal outcome (m2 — extended labels).
- `communication_turn_credentials_issued_total` — counts every
  successful `turn:request-credentials` ack.
- `communication_proxy_protocol_parse_failure_total` — increments
  when the PROXY protocol v2 parser fails to extract the original
  client IP from a connection on the HAProxy backend port (C1).
  Indicates HAProxy misconfiguration or a non-HAProxy source bypassing
  the loopback firewall.

**Histograms (added):**
- `communication_signal_publish_handler_duration_ms` — wall-clock
  duration of the `signal:publish` handler from rate-limit-check to
  `socket.to(room).emit` (m4). Buckets `0.5, 1, 2, 5, 10, 20, 50` ms.
  Alert if p99 > 5 ms — handler must do all work synchronously between
  rate-limit-check and emit (no `await` in between).

**Histograms (added — fanout):**
- `communication_signal_publish_recipients` — fanout size per
  `signal:publish` (buckets `0, 1, 2, 5, 10, 25, 50` to match the
  per-room cap).

**Gauges:**
- `communication_active_rooms`
- `communication_active_sockets`
- `communication_pending_correlations`
- `communication_jwks_consecutive_failures` (m5, M16)

**Cardinality note (m9).** No metric carries `roomId` as a label —
UUID cardinality would explode Prometheus storage. Per-room debugging
uses logs (correlated by `roomId` field), not metrics.

### 11.4 Admin endpoint (m6)

`POST /admin/log-level` is the ONLY hot-reloadable knob in v1. It binds
to a separate port (`admin.port`, default `4446`, localhost-only by
default) and validates a shared-secret header (`X-Admin-Token` against
`admin.token`). Body: `{ level: 'debug'|'info'|'warn'|'error' }`. The
endpoint flips pino's level at runtime; everything else still requires
a process restart.

---

## 12. Security Considerations

### 12.1 Authentication (Google OpenID Connect)

We replace the v1 "no auth" plan with a full OIDC-validated handshake.
Every connection arrives with a Google ID token; we check signature, `iss`,
`aud`, and `exp`. The middleware is the single choke point — there is no
way to reach the room registry without passing it.

**Threat coverage:**
- **Forged tokens (no key)** — defeated by signature verification against
  Google JWKS.
- **Forged tokens signed with attacker's own key** — defeated by JWKS
  pinning to Google's `https://www.googleapis.com/oauth2/v3/certs`.
- **Algorithm-confusion attacks (`alg: 'none'`, HS256-with-public-key, etc.)** —
  **defeated by passing `algorithms: ['RS256']` to `jose.jwtVerify` (C4).**
  Google ID tokens are RS256; pinning the allowlist forecloses every
  algorithm-substitution avenue.
- **Tokens issued for a different OAuth client** — defeated by `aud` check
  against `GOOGLE_OAUTH_CLIENT_ID`. Additionally, when the OPTIONAL `azp`
  (authorized party) claim is present, the verifier asserts
  `azp === GOOGLE_OAUTH_CLIENT_ID` and rejects mismatches with
  `auth/wrong-audience` (M9).
- **Tokens issued by a different OIDC provider** — defeated by `iss` check
  against the Google issuer set.
- **Expired tokens** — defeated by `exp` check. We pass an explicit
  `clockTolerance: config.auth.clock_tolerance_seconds` (default 5 s) to
  `jose.jwtVerify`. **Note:** `jose`'s default `clockTolerance` is `0`, NOT
  ~5 s — the previous draft of this document was wrong on that point. We
  override to 5 s deliberately so cheap VMs with mild clock drift do not
  spuriously reject otherwise-valid tokens (m1).
- **Stolen ID tokens** — out of scope for the server. Mitigation is short
  token TTL (Google ID tokens are 1 h by default) and the per-connection
  expiry lifecycle that forces refresh. A stolen token can connect once;
  it cannot be rotated, and disconnect happens at `exp` whether the
  attacker likes it or not.
- **Replay across rooms** — accepted: a token grants the user identity, not
  a specific room. Authorisation per room (e.g. invite-only rooms) is a v2
  concern. See §12.6 for the v1 authorisation model.

**Error message opacity (M15).** The error surfaced to the client is
`new Error('auth')` with `err.data = { code: AuthErrorCode }` ONLY. The
original `jose` error message (which can contain JWS / JWK / JWT
implementation detail) is logged server-side at `warn` with `socketId`
and `code`, NEVER propagated to `connect_error.message` or `ack.error`.
Test in §9: `connect_error.message` does not contain `jose` / `JWS` /
`JWK` strings.

**Refresh-time identity-binding checks (M10).** On `auth:refresh-token`,
after the new token verifies cleanly, the server compares it to the
existing claims:
- `newClaims.sub !== existingClaims.sub` → reject with
  `auth/sub-mismatch` (NEW code, see `AuthErrorCode` union).
- `newClaims.iat <= existingClaims.iat` → reject with `auth/invalid-token`
  (replay protection).
- If existing token has `sid` claim, require `newClaims.sid === existingClaims.sid`
  → otherwise reject with `auth/invalid-token`.

**Privacy — `userId` and `email` are never logged plaintext (M12).**
Logging always uses `userIdHash = sha256(userId).slice(0,16)`; helper
`hashUserId()` lives in `application/`. `email` is never logged at any
level. Redaction list (see §11.1) covers `userId`, `email`, `idToken`.

**JWKS rotation:** `jose.createRemoteJWKSet` caches keys with a built-in
TTL and refreshes on `kid` miss. Google rotates keys on a multi-day cadence;
the cache handles it transparently.

**`displayName` is NOT trusted as an identifier.** It is free-form user
input (now sourced from the JWT `name` claim — M13), capped at 50 chars,
used for display only. The authoritative user identifier is `userId`
(internally backed by the JWT `sub` claim, but never referred to as
`sub` outside `GoogleIdentityVerifier`). Two users may pick the same
display name; the UI is responsible for disambiguation.

### 12.2 CORS

Fastify mounts `@fastify/cors`. Socket.IO has its own `cors` option on
construction — both honour `IServerConfig.corsAllowedOrigins`.

- Dev: `CORS_ALLOWED_ORIGINS=*` is allowed; logged as a warn at startup.
- Prod (`NODE_ENV=production`): empty / `*` value crashes startup. Origin
  must be a comma-separated allowlist. Logic mirrors
  `apps/signaling/src/server.ts` `isOriginAllowed`.

### 12.3 Resource Exhaustion

Defences in v1:
- 50 members / room (`room.max_listeners`).
- ≤ 5 tabs per `userId` per room (`room.max_tabs_per_user`, m3) — `Room.addMember`
  rejects with `RoomFullError` (variant `'too-many-tabs'`) when the same
  `userId` is already present that many times.
- ≤ 32 in-flight `command:initiate` correlations per socket
  (`room.max_inflight_dispatches_per_socket`, M8) — 33rd attempt
  immediately acks `kind: 'dispatch-rejected', reason: 'too-many-in-flight'`.
- 1 MB payload cap.
- 10 s per-responder ack timeout.
- Per-socket disconnect cleans up member set + cancels in-flight routes.
- Token-expiry disconnect bounds connection lifetime to ≤ 1 h (Google ID
  token TTL).
- **Rate limiting at the upgrade route (M11):**
  - `@fastify/rate-limit` (added to root `package.json` `dependencies`)
    is registered on the WS upgrade route with TOML-configurable per-IP
    per-minute budget (`security.handshake_rate_per_ip_per_minute`,
    default 60). Rejected upgrades produce
    `connect_error { data: { code: 'auth/rate-limited' } }`.
  - **Original client IP via PROXY proto v2 (C1).** In HAProxy mode,
    the rate-limit accounts the original client IP (parsed by the
    PROXY proto wrapper) — not `127.0.0.1`. Without PROXY proto the
    limit would be defeated.
  - Application-level per-IP failed-handshake counter (in-memory `Map`,
    sliding 30-second window). After
    `security.failed_handshake_block_threshold` (default 10) failures
    from one IP within the window the IP is blocked for
    `security.failed_handshake_block_seconds` (default 30) — every
    upgrade in that window is refused with `auth/rate-limited`. Counter
    resets on the next successful handshake from the same IP. Metric:
    `communication_handshake_rate_limited_total`.
- **TURN credential request rate limit (M7).** Server-side, per
  authenticated socket: at most
  `[turn] credential_requests_per_minute_per_socket = 5`. Overflow
  acks `{ ok: false, error: 'rate-limited' }`; connection stays alive.
  Bounds credential issuance abuse from a compromised client.

Defences explicitly *not* in v1 (see §13):
- No global room-count cap.
- No per-socket dispatch rate limit (per-correlation back-pressure
  covers the most-likely abuse path).

### 12.6 Authorization Model (M14)

**v1 treats `roomId` as a capability.** Anyone authenticated who knows
the UUID may join any room — there is no per-room allowlist, no
invite-only flag, no creator-of-room privilege. The UUID is the
capability; possession is permission.

**Operational implications.**
- UUIDs MUST NOT be embedded in shareable URLs or screenshots without
  considering disclosure risk. A pasted screenshot of a chat that
  contains the room URL grants membership to whoever sees the screenshot.
- The 50-member cap (`room.max_listeners`) bounds the blast radius of an
  accidentally leaked UUID.
- The 5-tab-per-user cap (`room.max_tabs_per_user`) bounds the
  per-attacker amplification.

**v2 will add per-room allowlists** keyed on `userId` — the room
creator (or a separate authorisation service) will populate an allowed
`userId` set, and `ConnectionLifecycle.onHandshake` will check membership
against it. The current capability-based model is a deliberate v1
simplification, not a forgotten requirement.

**Signaling and TURN authorization (extension).** Both `signal:publish`
and `turn:request-credentials` are reachable only on an
already-authenticated socket — there is no separate auth handshake. An
unauthenticated client cannot reach either event because handshake
middleware would have rejected the connection. As a corollary, **TURN
credentials are NEVER issued to anonymous clients.** The HMAC shared
secret never leaves the server.

### 12.7 TURN Credential Security

- **Shared secret is a real secret.** `turn.shared_secret` is sourced
  from `TURN_SHARED_SECRET` (mapped via
  `custom-environment-variables.json`), in turn from
  `/etc/communication/turn-secret` (chmod 600, owner =
  `communication`). Empty string in `default.toml`.
  `ConfigValidationError` at startup if empty in production with
  `turn.enabled = true`. **First concrete secret in this server** —
  the `custom-environment-variables.json` seam was designed for
  exactly this case.
- **Issued credentials expose `userIdHash`, NEVER raw `sub` or
  `email`.** TURN usernames are visible to every WebRTC peer in a
  call (RFC 7635 puts the username on the wire). The server-issued
  `username = ${expirySec}:${userIdHash}` keeps the user identifier
  unlinkable to a Google `sub` outside of this server's logs.
- **TTL is bounded.** `1 minute ≤ ttl_seconds ≤ 12 hours`, enforced
  by zod refine. Default 1 hour. Operators may shorten to limit
  exposure on credential leak; cannot extend beyond 12 hours.
- **`coturn` rate limits.** `turnserver.conf` sets `total-quota`,
  `user-quota`, and `max-bps` (values: `total-quota=100` concurrent
  allocations server-wide, `user-quota=4` per username (M7 — tightened
  from 12), `max-bps=2000000` ~2 Mbps per allocation). These bound
  abuse if a credential leaks. Documented in §15.5.
- **coturn log redaction (M10).** coturn writes a `userIdHash` per
  allocation by default (because the issued TURN `username` is
  `<unixExpirySec>:<userIdHash>`). Mitigated by `no-stdout-log`,
  `verbose=0`, `log-file=/var/log/coturn/turnserver.log`, plus
  aggressive logrotate (`/etc/logrotate.d/coturn` with `rotate 3 daily
  compress`, rendered by `render-journald-conf.sh`). v2: redacted log
  sink so even rotated logs do not retain the hash.
- **Secret rotation.** Single source of truth is
  `/etc/communication/turn-secret` (M11). Generate a new secret with
  `openssl rand -hex 32`, write `TURN_SHARED_SECRET=<hex>` (KEY=VALUE
  form for systemd `EnvironmentFile=`), then re-run
  `render-coturn-cfg.sh` (which sources the file and rewrites
  `static-auth-secret=$TURN_SHARED_SECRET` into `/etc/turnserver.conf`),
  then `systemctl restart coturn communication` together. Existing
  in-flight allocations are torn down at the coturn restart. v2 may
  add an automated rotation script. Documented in
  `apps/communication/README.md`.
- **No credential reuse across users.** The username embeds
  `userIdHash`, so the HMAC over the username binds the credential
  to that user. A peer cannot lift Alice's TURN cred and authenticate
  as Bob.

### 12.4 Auth Hook Placement

`io.use(authHandshakeMiddleware)` in `presentation/socket-handlers.ts` is
the single entry point. It calls `ConnectionLifecycle.onHandshake`
(M24 — collapsed from the previous `AuthHandshakeUseCase`), which
delegates the JWT work to `IIdentityVerifier`. To swap providers
(e.g. add Apple Sign-In) later, register a second `IIdentityVerifier`
implementation and choose between them based on a token claim or a
handshake field. The domain port stays unchanged.

### 12.5 Secrets vs Public Configuration

The TOML files commit to git; `local.toml` does not. The distinction:

- **Public identifiers — safe to commit.** `auth.google_oauth_client_id`
  is a Google OAuth client ID. It already ships in the SPA bundle that
  any browser can download. Committing it to `development.toml` /
  `production.toml` is acceptable and matches the public-on-the-wire
  reality. Different deploys (staging, prod) override it via the
  `GOOGLE_OAUTH_CLIENT_ID` env var.
- **Real secrets — never commit.** None exist in v1. Future secrets
  (Redis credentials, session signing keys, service-account JSON) MUST
  arrive via env-var overrides per `custom-environment-variables.json`,
  not via committed TOML. The startup config-log redaction list is the
  enforcement seam (see §11.1) — any new secret path must be added to
  `REDACTED_PATHS` in the same PR that introduces it.
- **Per-developer credentials.** `local.toml` is gitignored
  specifically so a developer can drop a personal Google client ID
  into it without the file ever reaching git. Documented in the
  README so newcomers do not commit dev keys by mistake.

### 12.8 Trust Boundary (with HAProxy + coturn)

```
+--------+   TLS    +---------+  TLS (passthrough)  +-----------+
| Browser|--------->| HAProxy |-------------------->| Fastify   |
|        |   :443   | (L4 SNI |     SNI=<IP>.       | (TLS term)|
|        |          | router) |     sslip.io         | :8443     |
+--------+          |         |                      +-----------+
                    |         |  TLS (passthrough)   +-----------+
                    |         |--------------------->| coturn    |
                    |         |     SNI=turn-<IP>.   | (TLS term)|
                    |         |     sslip.io          | :5349    |
                    |         |                      +-----------+
                    +---------+
   :3478 udp / :3478 tcp ----------- direct -----> coturn
   (UDP cannot traverse HAProxy; STUN+TURN plain go straight)
```

- **HAProxy is L4 SNI passthrough only.** It reads the unencrypted
  ClientHello SNI byte range, picks a backend, and pipes bytes to the
  selected backend. **It never decrypts.** TLS keys live only on
  Fastify and on coturn. A compromise of the HAProxy process does NOT
  expose user payloads or TURN credentials.
- **Fastify owns TLS for `<IP>.sslip.io`.** Reads
  `/etc/letsencrypt/live/communication/fullchain.pem` and `privkey.pem`
  on boot.
- **coturn owns TLS for `turn-<IP>.sslip.io`.** Reads the same files
  via `cert=` / `pkey=` directives.
- **The SAN cert is the shared trust artifact.** Both backends read
  the same files (no per-backend cert) so renewal hooks can reload
  both services with identical paths.
- **`:3478 udp` and `:3478 tcp` skip HAProxy.** UDP cannot share a
  port with HAProxy (which is TCP), and there is no TLS to route on
  the plain-TURN path. Both ports go straight to coturn.
- **PROXY protocol v2 carries the original client IP (C1).** Without
  it, the per-IP rate-limit (M11) sees `127.0.0.1` for every connection
  routed through HAProxy and the limit is defeated. HAProxy is
  configured with `send-proxy-v2` on both backends (Fastify and coturn,
  both ≥ 4.5.2 support PROXY proto via `--proxy-protocol`). Fastify is
  bootstrapped with `trustProxy: '127.0.0.1'` and a TCP-layer wrapper
  that parses the PROXY v2 header BEFORE TLS handshake (using
  `proxy-protocol-js` from root deps). The trust boundary is unchanged:
  loopback (`127.0.0.1`) is the only PROXY-proto source Fastify trusts;
  external clients cannot inject a forged header because UFW blocks
  external access to `:8443/tcp` and `:5349/tcp`. Parse failures
  increment `communication_proxy_protocol_parse_failure_total` (§11.3).
  In `--no-haproxy` mode there is no PROXY protocol — Fastify reads
  `socket.remoteAddress` directly.

---

## 13. Open Questions / Decisions Deferred

### 13.1 Resolved (committed in v1)

Each item below is closed and locked in by this revision. No further user
input is required to start implementation.

- **Schema-validation library:** `zod` — repo-wide standard (§10.1).
- **Authentication model:** Google OpenID Connect at handshake; per-conn
  expiry lifecycle; refresh event (§§2, 6, 12).
- **`algorithms: ['RS256']` in `jose.jwtVerify`** (C4) — defeats `none`
  / HS256-with-public-key / algorithm-confusion attacks. Required.
- **`azp` audience check** (M9) — when `azp` is present, must equal
  `GOOGLE_OAUTH_CLIENT_ID`.
- **Refresh-time identity binding** (M10) — `sub` must match,
  `iat` must strictly increase, `sid` must match if present.
- **JWKS retry strategy:** `auth.jwks.fetch_max_attempts = 3`,
  `auth.jwks.fetch_timeout_ms = 5000`, defaults in `default.toml`,
  overridable via env vars (§8.2).
- **JWKS unreachable -> fail-closed:** handshake refused (§10).
- **Refresh-with-invalid-token -> ack `{ ok: false }`, do NOT disconnect**
  (§§6.5, 10).
- **`displayName` derivation: `displayName ← claims.name` only.** If
  `name` is absent, the handshake is rejected with
  `auth/missing-name-claim`. **Supersedes earlier decision** (M13) to
  cascade `claims.name → claims.email`. Rationale: privacy — broadcasting
  email addresses to every room participant leaks identity (the
  `displayName` propagates into `users[]`, `command:execute.initiator`,
  and `command:response.responder`). The `email` scope is still
  requested by the client; v2 may use it for non-broadcast features.
- **Wire-event renames** (global): `command:dispatch → command:initiate`,
  `command:request → command:execute`, `room:listeners → room:presence`,
  `socketListeners → socketCount`. Internal: `Room.listeners → Room.members`.
  Earlier drafts used the old names; this revision is the single source
  of truth.
- **Broadcast on `displayName` change:** server emits `room:presence`
  whenever a refresh changes the cached identity (already covered by the
  presence broadcaster's recompute on every connection-event hook).
- **Multi-tab dedup:** **Variant A — dedup by `userId`.** Two browser
  tabs for the same Google account count as **one** entry in `users[]`
  and **two** in `socketCount`. Subject to `room.max_tabs_per_user` cap
  (default 5, m3). Server does NOT dedup `command:response` —
  client-side dedup if needed (M5). Confirmed by user.
- **Per-correlation per-responder state machine** (C2) — exactly one
  `Pending → Settled` transition per `(correlationId, responderSocketId)`.
- **Identity snapshot at fanout start** (C3) — survives mid-flight
  removal from `Room.members`.
- **Manual fanout** (C1) — `ICommandTransport.broadcastRequest` (M18)
  issues per-responder `emitWithAck` in parallel via `fetchSockets()`,
  NOT `socket.to(room).emitWithAck(...)`.
- **Per-socket dispatch back-pressure** (M8) —
  `room.max_inflight_dispatches_per_socket = 32`; over-cap acks with
  `kind: 'dispatch-rejected'`.
- **Rate limiting in v1** (M11) — **supersedes earlier deferral**
  (the 2287-line draft listed connection-attempt rate limiting under
  §13.2 Deferred; this revision moves it to v1). Two layers:
  `@fastify/rate-limit` on the upgrade route (per-IP per-minute budget,
  TOML key `security.handshake_rate_per_ip_per_minute`) and an
  application-level per-IP failed-handshake counter (sliding window;
  TOML keys `security.failed_handshake_block_threshold`,
  `security.failed_handshake_block_seconds`). Both surface
  `auth/rate-limited` to the client. Adds `@fastify/rate-limit` to root
  `dependencies`.
- **OpenMetrics via `prom-client`** (M17) — supersedes the earlier
  "no `prom-client` in v1" note. Histograms, counters, gauges as
  enumerated in §11.3. Adds `prom-client` to root `dependencies`.
- **Two health endpoints** (M16) — `/health/live` and `/health/ready`,
  with JWKS health surfaced via `IVerifierHealth`.
- **Two-phase graceful shutdown** (M18) —
  `server.shutdown_grace_ms = 11000`; `server:draining` broadcast
  before drain.
- **DDD layer cleanup:**
  - DELETED: `IClock`, `IScheduler`, `SystemClock`, `NodeScheduler`
    (M23). `TokenLifecycle` uses `setTimeout` + `Temporal` directly;
    tests use `vi.useFakeTimers()`.
  - DELETED: `AuthHandshakeUseCase`, `RefreshTokenUseCase` (M24).
    Collapsed into `ConnectionLifecycle.onHandshake / onRefresh /
    onDisconnect`.
  - DELETED: `ResponderTimeoutError`, `ResponderDisconnectedError`
    (M22). The discriminated `kind` markers replace them.
  - MOVED: `IServerConfig.ts` and `server-config-schema.ts` from
    `domain/` to `application/config/` (M25).
  - RENAMED: `domain/RoomRegistry.ts` → `domain/IRoomRegistry.ts`
    (M26 — file name follows primary export).
- **Privacy-preserving logging** (M12) — `userIdHash =
  sha256(userId).slice(0,16)`; never log `userId`/`email`/`idToken`
  plaintext.
- **Authorization model = capability** (M14, §12.6) — UUID is the
  capability; v2 adds per-room allowlist.
- **Configuration:** `node-config` + layered TOML +
  `custom-environment-variables.json`; loader in
  `infrastructure/load-config.ts`; zod schema in
  `application/config/server-config-schema.ts` (§§4.1, 8).
  Production-vs-dev guard (m2). Production-CORS refine (m8).
  `getConfigSources()` for error messages (M21).
- **Admin endpoint** (m6) — `POST /admin/log-level` on a separate
  port; only hot-reloadable knob in v1.
- **Audit logging port** (M4) — `IAuditLogger` + `PinoAuditLogger`.
- **Bundle hygiene assertion** (m7) — script fails the build if
  server-only deps appear in the portfolio bundle.
- **Client OAuth scope requirement** documented (§2): client requests
  `openid profile email`. Server enforces ONLY by rejecting tokens
  missing `name` (M13 — does NOT cascade to `email`).
- **Build-pipeline wiring:** root `pnpm build` runs both portfolio and
  communication targets via Moon `tag: application` fan-out (§8.17, §14).
- **Client integration deferred to a follow-up PR** (m14) — out of scope.
- **Replaces `apps/signaling`** — new server takes over signaling. v1
  ships the server side (protocol + deployment infra). v1.1 will
  migrate `apps/portfolio` retro/conf features. v1.2 deletes
  `apps/signaling`. Confirmed by user (D=A=iii).
- **All events under OIDC — no anonymous signaling.** Retro/conf users
  must sign in with Google. UX regression accepted and documented.
  Confirmed by user (B=ii).
- **Phased rollout (P3).** v1 = server + skeleton signaling protocol +
  full deployment infrastructure (HAProxy + coturn + sslip.io + SAN
  cert). v1.1 = frontend migration of retro/conf off `apps/signaling`.
  Frontend migration is OUT OF SCOPE for this plan. Confirmed by user
  (C=P3).
- **TURN credentials: ephemeral HMAC only (RFC 7635 / coturn
  `--use-auth-secret`).** No long-term static creds, ever. Confirmed
  by user (D=ii).
- **Edge networking: HAProxy SNI passthrough preferred.** One Let's
  Encrypt SAN cert covering `<IP>.sslip.io` and `turn-<IP>.sslip.io`.
  Fallback (direct ports, no HAProxy) is supported via `--no-haproxy`
  install flag.
- **PROXY protocol v2 end-to-end (C1).** HAProxy → Fastify and HAProxy
  → coturn both use `send-proxy-v2`. Fastify parses via
  `proxy-protocol-js` (added to root deps) before TLS handshake, with
  `trustProxy: '127.0.0.1'`. coturn (≥ 4.5.2) accepts via
  `proxy-protocol`. **Supersedes** the prior assumption that the
  per-IP rate-limit (M11) sees real client IPs — without PROXY proto
  it would see `127.0.0.1` and the limit would be defeated. New
  metric `communication_proxy_protocol_parse_failure_total`.
- **First-boot ordering — certbot before services (C2).**
  `obtain-letsencrypt-cert.sh` runs BEFORE
  `enable-systemd-services.sh`. UFW temporarily allows `80/tcp` during
  the obtain step; `configure-ufw.sh` revokes it. The systemd unit
  file is rendered earlier but the service is not started until cert
  files exist. **Supersedes** the earlier monolithic-script ordering
  that started services before the cert was guaranteed present.
- **UFW + coturn loopback bind in HAProxy mode (C3).** TURNS port
  5349 binds `listening-ip=127.0.0.1` in HAProxy mode (loopback only).
  UFW is mode-conditional: HAProxy mode allows 443/tcp + 3478/{udp,tcp}
  + 22/tcp; `--no-haproxy` mode additionally allows 5349/tcp. Never
  both allow and deny 5349 simultaneously. **Supersedes** the earlier
  fallback narrative that left the rule unclear.
- **y-webrtc client adapter for v1.1 (C4 — see §6.Y.6).** Stock
  y-webrtc `WebrtcProvider` is wire-incompatible with this server's
  Socket.IO + OIDC envelope. v1.1 ships a custom `SignalingConn`
  adapter; one topic = one socket; `from.socketId` filters self-
  echoes. **Scope warning: this is one of five v1.1 workstreams**
  (see §13.2 v1.1 entry); v1.1 ≈ v1 in size.
- **TURN cred TTL bump (M4).** Default `turn.ttl_seconds = 43200`
  (12 h); zod max `86400` (24 h). **Supersedes** the prior 1 h
  default / 12 h max.
- **HMAC argument order (M5).** `crypto.createHmac('sha1',
  sharedSecret).update(username).digest('base64')` — secret first,
  username via `update`. Unit test pins the result against a
  hand-computed reference value.
- **denied-peer-ip mandatory (M6).** Full RFC1918 + link-local + IPv6
  ULA + IPv6 link-local + carrier-grade NAT range list rendered into
  `turnserver.conf`.
- **TURN quotas tightened + Fastify rate-limit on credentials
  (M7).** `user-quota=4` (was 12). Server-side rate limit
  `[turn] credential_requests_per_minute_per_socket = 5` on
  `turn:request-credentials`; overflow returns
  `{ ok: false, error: 'rate-limited' }`.
- **TURN URL port mode-conditional (M8).** HAProxy mode uses port
  `443` for TURNS; `--no-haproxy` mode uses `5349`.
  `render-toml-configs.sh` templates the correct port at install
  time.
- **coturn TLS hardening (M9).** `no-tlsv1`, `no-tlsv1_1`,
  `cipher-list`, `ecdh-curve`, `dh-file`,
  `no-stun-backward-compatibility`, `no-tcp-relay` rendered into
  `turnserver.conf`. `obtain-letsencrypt-cert.sh` generates
  `/etc/coturn/dhparam.pem` (idempotent).
- **coturn log redaction (M10).** `no-stdout-log`, `verbose=0`,
  `log-file=/var/log/coturn/turnserver.log`; logrotate config rendered
  by `render-journald-conf.sh` with `rotate 3 daily compress`. v2: a
  redacted log sink so even rotated logs do not retain `userIdHash`.
- **Single-source TURN secret (M11).**
  `/etc/communication/turn-secret` (chmod 640, root:communication)
  written as `TURN_SHARED_SECRET=<hex>`. Both consumers read it:
  systemd `EnvironmentFile=` for the Communication service;
  `render-coturn-cfg.sh` sources the file and writes
  `static-auth-secret=$TURN_SHARED_SECRET` into `/etc/turnserver.conf`.
  Two consumers, ONE source of truth.
- **HAProxy ACL exact match + reject default (M12).**
  `req.ssl_sni -i -m str <hostname>`; `default_backend reject`.
  **Supersedes** the earlier `-m beg` / `-m end` / `default_backend
  fastify` config — exact match closes the SNI-spoof gap, and
  default-reject treats unknown SNI as an attack indicator.
- **HAProxy timeouts (M13).** `timeout connect 5s`, `client 1h`,
  `server 1h`, `tunnel 24h`. WebSocket and TURN both need long
  tunnels.
- **Cert renewal: 2-phase drain via SIGTERM, NOT zero-drop reload
  (M14).** Renewal hook drains and restarts the service. Documented
  user-visible "every ~60 days, all sessions drop after a graceful
  drain". Zero-drop TLS context reload deferred to v2.
- **Renewal hook fail-fast (M15).** `set -eu`; NO `|| true`. Separate
  cert-expiry systemd timer alerts journald-warn at 7 days.
- **PROXY metric and trust boundary (C1, M11).** New metric
  `communication_proxy_protocol_parse_failure_total`. HAProxy passes
  `original_client_ip` via PROXY proto v2 → Fastify trusts loopback as
  the only PROXY proto source.
- **Modular install.sh / upgrade.sh (Part A).** Both orchestrators
  run LOCALLY on the operator's machine. They rsync `lib/` to the
  target and invoke each sub-script via ssh. **Supersedes** the
  earlier monolithic `install.sh` / `upgrade.sh` plan: the former had
  one giant root-on-target script that grew unmanageably; the new
  layout localises failures to a single step, every sub-script is
  idempotent, and each is unit-testable via shellcheck or bash dry-
  run. v2 may swap the orchestration layer for Ansible without
  rewriting any sub-script.
- **§7.2 install.sh / upgrade.sh entries replaced** by one entry per
  sub-script (orchestrator + each `lib/` script), one line per file.
- **Port god-object split (M18).** `IRoomTransport` is split into
  four narrower ports: `ICommandTransport`, `IPresenceTransport`,
  `ISignalTransport`, `ILifecycleTransport`. Each use case depends
  only on what it needs (`CommandRouter → ICommandTransport`,
  `PresenceBroadcaster → IPresenceTransport`,
  `SignalRelay → ISignalTransport`,
  `ConnectionLifecycle → ILifecycleTransport`).
  `infrastructure/SocketIORoomTransport.ts` implements all four.
  Tests use `FakeCommandTransport`, `FakePresenceTransport`,
  `FakeSignalTransport`, `FakeLifecycleTransport` (each tiny).
- **README expansion (M19).** README is now ~150-300 lines,
  operator/integrator-facing. **Supersedes** the earlier "short
  README pointing at server.md" entry.
- **Multi-tab `from.socketId` (M3).** `from = { userId, displayName,
  socketId }` where `socketId` is a server-generated UUID stamped on
  `socket.data` at handshake (NOT Socket.IO's internal `socket.id`).
- **Signaling rate limit raised (M1).** `[signal]
  max_publish_per_second_per_socket = 100` (refill);
  `max_publish_burst = 200`. **Supersedes** the prior default of 30.
- **One Yjs doc per page constraint (M2).** v1 ships with this
  constraint. Lifting it (multi-room-per-socket) is a v2 deferred
  item.
- **§6.Y wire-format additions (m1, m2, m3, m5).**
  `max_payload_bytes = 16384` (m1, oversize → `payload-too-large`,
  empty/null → `invalid-payload`); ack errors include `not-in-room`
  (m2 — supersedes `'internal'` for the missing-room race);
  `correlationId` is opaque server-side and does NOT count against
  `max_inflight_dispatches_per_socket` (m3); `recipientCount`
  semantic clarified to `room.size - 1` (m5).
- **NTP package install (m6).** `ensure-system-packages.sh` installs
  + enables `systemd-timesyncd`. Documented as required for HMAC
  expiry skew tolerance.
- **coturn realm matches URL host (m7).** `realm=turn-<IP>.sslip.io`.
- **`unixExpirySec` variable rename (m8).** Per coturn
  `--use-auth-secret`, the leading integer in `username` is the
  Unix timestamp at which the credential expires (NOT a duration).
- **sslip.io DNS unreachable acceptable (m9).** Documented as
  acceptable for personal/portfolio use; production should configure
  a real domain. v2: replace sslip.io default with self-hosted DNS or
  document real-domain switchover.
- **Same SAN cert serves both hostnames (m10).** Explicitly
  documented in §15.6.
- **Application Node-stdlib rule (m11).** `application/` MAY import
  `node:crypto`, `node:timers`, `Temporal` directly. MUST NOT import
  `socket.io`, `fastify`, `jose`, `node-config`, `node:fs`,
  `node:net`. Documented in §5.3.
- **domain types-only rule (m12).** `domain/Identity.ts`,
  `domain/Signal.ts` must NOT import `zod`, `socket.io`, `fastify`,
  `node-config`. Schemas live in `protocol-validators.ts`.
- **Test doubles enumerated (m13).** `SignalRelay` tests use
  `FakeSignalTransport`, `FakeAuditLogger`, `FakeServerLogger`, in-
  memory `IRoomRegistry`. `IssueTurnCredentialsUseCase.test` uses a
  hand-computed HMAC reference (`secret='test-secret'`,
  `userId='user-123'`, `nowEpochMs=1_700_000_000_000`, `ttl=3600`).
- **Schema modularization (m14).**
  `application/config/server-config-schema.ts` composes section
  schemas in `application/config/sections/*.ts` (one file per TOML
  section).
- **v1.2 deletion criterion (m15).** Trigger: 30 consecutive days of
  zero connections to `apps/signaling` (verified via the existing
  periodic `topics=N peers=N` log line). Then delete
  `apps/signaling/` source + drop from `pnpm-workspace.yaml` + drop
  Moon target + decommission Fly app.
- **No utilities extracted from apps/signaling to libs (m16).**
  Legacy helpers (`isOriginAllowed`, `parseMessage`, `safeSend`,
  manual ping interval) are tied to raw `ws` semantics; Socket.IO
  supplies equivalents via its own config (`cors`, `pingInterval`,
  `pingTimeout`, internal framing). Sharing would couple to a
  deprecated module.
- **User-Visible Regressions section (M17).** §1.1 — after v1.1,
  retro/conf will refuse anonymous users. Sign-in UI ships in v1.1.
- **Synchronous signal-publish handler (m4).** Handler must do all
  work synchronously between rate-limit-check and `socket.to(room)
  .emit` (no `await` in between). New histogram
  `communication_signal_publish_handler_duration_ms`; alert if p99 >
  5 ms.

### 13.2 Deferred (v2 or later)

- **Global room-count cap.** Add `MAX_TOTAL_ROOMS` (TOML key
  `room.max_total_rooms`) + 503 on handshake when exceeded.
- **Per-socket dispatch rate limit (token bucket).** Token bucket per socket. Configured
  via TOML (`room.dispatch_rate_per_minute`) once we have evidence of
  abuse.
- **Per-command token re-introspection.** Currently we validate at
  handshake + on refresh; in-flight commands trust the connection. v2
  could re-verify on each `command:initiate`. Cost: +1 verifier call per
  command. Not worth it in v1.
- **Sample `local.toml`.** Currently no committed sample; we may decide
  later that a documented `local.toml.example` is friendlier to
  newcomers.
- **`production.local.toml` for site-specific secrets.** `node-config`
  picks up the `<env>.local.toml` pattern automatically. We do not
  exercise it in v1 because there are no production secrets, but it is
  the recognised seam.
- **`@frozik/config` shared lib.** If a second app starts using
  `node-config` (e.g. `apps/signaling` migrates), we extract the loader +
  schema scaffolding into a workspace package. Premature in v1 with one
  consumer.
- **`Biome` `noRestrictedImports` for layer enforcement.** Currently
  relying on review + `madge` + a domain-level test. Defer until a
  violation actually slips through.
- **Schema-validation invalid-payload logging.** Should `warn` on every
  invalid payload include the *first 200 bytes* of the offending payload?
  Helpful for debugging, risky for PII. Default off, env switch
  `LOG_INVALID_PAYLOADS=true` for ops.
- **v1.1 — Frontend retro/conf migration to the new server (M16).**
  **Scope warning: v1.1 ≈ v1 in size.** The migration is not a "drop-
  in" — it is its own workstreams-heavy delivery. Five workstreams
  must ship together:
  1. **Google sign-in UI** in `apps/portfolio` (the legacy anonymous-
     share-the-link flow disappears at v1.1 — see §1.1 user-visible
     regression).
  2. **y-webrtc adapter** (see §6.Y.6) — custom `SignalingConn`
     wrapping Socket.IO + OIDC handshake; per-topic socket;
     outbound/inbound translation; `from.socketId`-based self-echo
     filter.
  3. **Refresh-token loop** — client subscribes to
     `auth:token-expiring`, fetches a fresh ID token via Google
     Identity Services, emits `auth:refresh-token`.
  4. **`turn:request-credentials` plumbing** — replace hardcoded ICE
     servers with a runtime fetch over the authenticated socket; pipe
     the `{ urls, username, credential }` shape into
     `RTCPeerConnection`'s `iceServers`.
  5. **Delete `apps/portfolio/src/features/conf/domain/ice-servers.ts`**
     and any sibling hardcoded TURN config.
- **v1.2 — Delete `apps/signaling`.** Trigger criterion (m15): 30
  consecutive days of zero connections (verified via the existing
  `topics=N peers=N` log line). Then remove `apps/signaling/` source
  + drop from `pnpm-workspace.yaml` + drop the Moon target +
  decommission the Fly app.
- **Zero-drop TLS context reload (v2).** SHIPPED in v2.
  `infrastructure/CertWatcher.ts` watches `cert_path`/`key_path` via
  `fs.watch`; bootstrap installs it when TLS is enabled and refreshes the
  https server's TLS context via `setSecureContext` without dropping
  active connections. The certbot deploy hook
  (`render-renewal-hook.sh`) reloads HAProxy + coturn only — no longer
  SIGTERMs the communication service.
- **Multi-room-per-socket (v2).** Lift the M2 "one Yjs document per
  page" constraint. Requires reshaping `roomId`-as-socket-property
  into a per-socket `Set<RoomId>` and reworking presence accounting.
- **sslip.io DNS contingency (v2).** SHIPPED in v2.
  `obtain-letsencrypt-cert.sh` runs `dig` before `certbot` and fails
  fast with an actionable error when DNS resolution returns empty
  (sslip.io transient outage or a wrong `--domain`). README §"DNS
  dependencies" documents the recommendation to use a real domain
  for production deploys.
- **Automated TURN secret rotation (v2).** Today rotation requires
  manually editing `/etc/communication/turn-secret` and re-running
  `render-coturn-cfg.sh` + `systemctl restart coturn communication`
  (M11). v2 ships a script that does this end to end on a cron
  schedule.
- **Mid-call ICE restart with refreshed creds (v2 — see M4).**
  SHIPPED in v2. Server emits `turn:credentials-renewed` after every
  successful `auth:refresh-token`; the conf client subscribes via
  `CommunicationClient.onTurnCredentialsRenewed` and (when a peer
  connection is live) calls
  `IConfPeerConnection.refreshIceServers(iceServers)` which invokes
  `RTCPeerConnection.setConfiguration` + `restartIce`. Browsers
  without `setConfiguration` support fall back gracefully — the
  existing call continues with the old creds and the next call
  picks up fresh ones. Retro is deferred to v3 because
  `WebrtcProvider` does not expose mid-call ICE restart.
- **Per-room allowlist (§12.6).** SHIPPED in v2.
  `application/RoomAllowlistChecker.ts` enforces a `[room] allowlist`
  TOML list at handshake time; rejected joins surface as
  `auth/forbidden-room`. Empty allowlist = no enforcement (backward
  compatible default).
- **Multi-node clustering / Redis adapter.** SHIPPED in v2.
  `[redis] enabled = true` swaps `InMemoryRoomRegistry` for
  `RedisRoomRegistry` (hash-per-room layout) and registers
  `@socket.io/redis-adapter` so cross-node broadcasts fan out via
  pub/sub. `lib/ensure-redis.sh` provisions a localhost-bound
  `redis-server` on the host (skipped via `--no-redis`).
- **Lift one-Yjs-doc-per-page constraint (v2 / M2).** Currently a
  second collaborative doc requires a second authenticated socket;
  v2 multiplexes multiple rooms per socket.
- **TURN long-term static credentials.** Intentionally never. Do not
  re-open this question.
- **SDP-aware signaling features (call quality metrics, codec
  negotiation hints).** Protocol stays opaque. Adding parsing means
  re-implementing a half-baked SFU. Out of scope.
- **Multi-region TURN.** v2+. Single-region (one VM) is sufficient for
  the demo footprint.

---

## 14. Implementation Steps (Ordered Checklist)

This is the order the implementation agent should follow. Each step is a
self-contained PR-sized chunk; the `pnpm types && pnpm lint` tasks must
pass at every step.

1. **Scaffolding only (no business logic).**
   - Create `apps/communication/` with `package.json`, `tsconfig.json`,
     `tsconfig.build.json`, `moon.yml`, an empty `src/main.ts` (just
     `console.log('boot')`), `README.md` (covers env vars + the §2 client
     OAuth scope requirement), `Dockerfile`, `scripts/docker-build.sh`.
   - Add to root `package.json` `dependencies`: `fastify`, `socket.io`,
     `zod`, `jose`, `config`, `toml`, `@fastify/rate-limit`,
     `prom-client`, `proxy-protocol-js` (C1). To `devDependencies`:
     `socket.io-client`, `pino-pretty`, `@types/config`. (Latest
     stable major at install time — versions resolved by `pnpm add`.)
   - Run `pnpm install`.
   - Add the `apps/communication/src/**` Biome override.
   - `pnpm types && pnpm lint` — must pass.

2. **Configuration layer (M21, M25, m2, m8).**
   - Create `apps/communication/config/`: `default.toml` (every key with
     a safe default per §8.2 — including `[security]`, `[admin]`,
     `room.max_tabs_per_user`, `room.max_inflight_dispatches_per_socket`,
     `server.shutdown_grace_ms`, `auth.clock_tolerance_seconds`),
     `development.toml`, `production.toml`, `test.toml`,
     `custom-environment-variables.json` (§8.4 sample).
   - Add `apps/communication/config/local.toml` to `.gitignore` (§8.9).
   - Application: `application/config/IServerConfig.ts` — typed shape;
     `application/config/server-config-schema.ts` — zod
     `ServerConfigSchema` (with prod-CORS refine, m8) +
     `parseServerConfig` + `IServerConfig.test.ts`.
   - Infrastructure: `infrastructure/load-config.ts` (`loadConfig` and
     `loadConfigFromObject`; surfaces `config.util.getConfigSources()`
     in error messages — M21; m2 prod-vs-dev guard) +
     `load-config.test.ts`.
   - Wire `package.json` `dev` and `start` scripts to set
     `NODE_CONFIG_DIR` and `NODE_CONFIG_ENV` (§8.12).
   - **Verify:** the `config` (npm) package is imported in exactly one
     file, `infrastructure/load-config.ts`. Add a test that walks
     `domain/` and `application/` and asserts no transitive import.
   - `pnpm types && pnpm lint && pnpm test` — must pass.

3. **Domain layer — protocol types + validators.**
   - `types.ts` (m12 — Opaque only on `RoomId`/`UserId`/`DisplayName`),
     `constants.ts` (protocol invariants only — no operational
     tunables), `errors.ts` (no `ResponderTimeoutError` /
     `ResponderDisconnectedError` — M22), `protocol.ts` (incl.
     `server:draining`, `signal:publish`, `signal:event`,
     `turn:request-credentials`), `protocol-validators.ts` (zod schemas
     for handshake + commands + auth + signal-publish wrapper +
     turn-credentials ack — inner signal payload stays opaque) + tests.
   - `domain/Signal.ts` — types `SignalEvent`, `SignalPublishPayload`,
     `SignalAck` (pure types, no logic).

4. **Domain layer — Identity + verifier port.**
   - `Identity.ts` (incl. `'auth/sub-mismatch'` and
     `'auth/rate-limited'` in `AuthErrorCode`), `IIdentityVerifier.ts`.
     No tests (interface only).

5. **Domain layer — Room + IRoomRegistry (M26).**
   - `Room.ts` (members map; `addMember` enforces `max_listeners` AND
     `max_tabs_per_user`; dedup by `userId` in `getUsers()`) + tests,
     `IRoomRegistry.ts` (renamed from `RoomRegistry.ts`),
     `InMemoryRoomRegistry.ts` + tests.

6. **Infrastructure — GoogleIdentityVerifier (C4, M9, M13, M16).**
   - `GoogleIdentityVerifier.ts` + integration test (local RSA keypair +
     in-memory JWKS HTTP server). Exercises every `AuthErrorCode`
     including `auth/missing-name-claim` (no email cascade — M13),
     algorithm pinning (C4 — HS256 token rejected; `alg: 'none'`
     rejected), `azp` mismatch (M9), `clock_tolerance_seconds` override
     (m1). Implements `IVerifierHealth` (M16/m5).

7. **Application — TokenLifecycle + ConnectionLifecycle + hashUserId
   (M23, M24, M12).**
   - `application/hashUserId.ts` + `hashUserId.test.ts` (M12).
   - `TokenLifecycle.ts` + tests using `vi.useFakeTimers()` +
     `vi.setSystemTime()` — NO `IClock` / `IScheduler` (M23).
     Generation guard (M6).
   - `ConnectionLifecycle.ts` (collapsed — M24) + tests covering
     handshake, refresh (incl. M10 sub/iat/sid binding), disconnect.

8. **Application — CommandRouter + PresenceBroadcaster + ports.**
   - **Four port files** (M18 — split): `ports/ICommandTransport.ts`
     (manual fanout contract — C1; abort signal — M2),
     `ports/IPresenceTransport.ts`, `ports/ISignalTransport.ts`
     (`broadcastSignalEvent(roomId, excludingSocketId, event):
     number`), `ports/ILifecycleTransport.ts`. Plus
     `ports/IServerLogger.ts`, `ports/IAuditLogger.ts` (M4),
     `ports/IVerifierHealth.ts` (M16/m5).
   - `CommandRouter.ts` (depends on `ICommandTransport` only — M18;
     per-correlation per-responder state machine — C2; Identity
     snapshot — C3; back-pressure — M8; orphan handling — M7) +
     tests (covers C2/M2/M3/M5/M8/C3 cases). Tests use
     `FakeCommandTransport`.
   - `PresenceBroadcaster.ts` (depends on `IPresenceTransport` only —
     M18) + tests with `FakePresenceTransport`.

8a. **Application — SignalRelay + IssueTurnCredentialsUseCase
   (signaling + TURN scope additions).**
   - `application/SignalRelay.ts` + `SignalRelay.test.ts`. Uses
     `ISignalTransport.broadcastSignalEvent` (M18). Implements the
     per-socket token-bucket rate limit (§6.Y.4 — refill 100/s, burst
     200) and payload-size / null-payload validation (m1).
   - `application/IssueTurnCredentialsUseCase.ts` +
     `IssueTurnCredentialsUseCase.test.ts`. **Pure** — calls
     `node:crypto.createHmac('sha1')` directly; no port. Deterministic
     fixture verifies HMAC against a hand-computed reference value
     (test comment shows the openssl one-liner).
   - Update zod `ServerConfigSchema` to validate the new `[signal]`,
     `[turn]`, `[server.tls]`, `[edge]` config sections per §8.2.
     **Modularize per m14:** create
     `application/config/sections/{server,auth,room,signal,turn,edge,security,admin,logging,build}-section.ts`,
     each exporting one zod object schema; `server-config-schema.ts`
     composes them. Required: production refine — empty
     `turn.shared_secret` with `turn.enabled = true` rejected;
     `turn.ttl_seconds` bounded `[60, 86400]` (M4).

9. **Infrastructure — transport + logger + audit logger.**
   - `SocketIORoomTransport.ts` (M18 — `implements ICommandTransport,
     IPresenceTransport, ISignalTransport, ILifecycleTransport`).
     Manual per-responder fanout via `fetchSockets()` — C1;
     `emitDraining` — M18; `auth:refresh-token` handler;
     **`broadcastSignalEvent` implemented via `socket.to(roomId)
     .except(excludingSocketId).emit('signal:event', event)`** — no
     ack collection, returns `room.size - 1` as `recipientCount` (m5).
     Integration test in `SocketIORoomTransport.integration.test.ts`
     and `bootstrap.signal.integration.test.ts`.
   - `PinoServerLogger.ts`, `PinoAuditLogger.ts` (M4).

10. **Presentation layer + composition root + rate limiting (M11) +
   metrics (M17) + admin (m6).**
    - `http-routes.ts` — `/health/live`, `/health/ready` (M16),
      `/metrics` via `prom-client` (M17, including the new
      `communication_signal_publish_total{outcome}`,
      `communication_signal_publish_recipients` histogram, and
      `communication_turn_credentials_issued_total`),
      `/admin/log-level` on separate admin port (m6).
    - `socket-handlers.ts` — registers `@fastify/rate-limit` on the
      upgrade route + per-IP failed-handshake block (M11); wires
      `ConnectionLifecycle.onHandshake/onRefresh/onDisconnect`;
      registers `signal:publish` -> `signalRelay.publish(...)` and
      `turn:request-credentials` -> `issueTurnCredentials(...)` (only
      when `config.turn.enabled === true`); broadcasts `server:draining`
      on shutdown (M18).
    - `bootstrap.ts` + integration tests (with stubbed
      `IIdentityVerifier` and a config built via `loadConfigFromObject`
      so tests do not depend on the `node-config` global). When
      `config.server.tls.enabled = true`, Fastify is constructed with
      `https: { cert: readFileSync(cert_path), key: readFileSync(key_path) }`
      so it listens with TLS on `127.0.0.1:8443` (production); when
      `false`, Fastify listens plain HTTP on `:4445` (dev).
    - Hook up `src/main.ts` to call `loadConfig()`, construct the real
      `GoogleIdentityVerifier`, build the audit logger, and call
      `bootstrap`. Two-phase SIGTERM (M18).
    - `pnpm dev` should start a working server.

11. **Integration tests — wide.**
    - Full happy-path initiate <-> response cycle with two clients.
    - Token-expiring + refresh success.
    - Token-expired disconnect + presence updates.
    - Refresh-with-invalid-token leaves the connection alive.
    - Token signed validly with no `name` claim → rejected with
      `auth/missing-name-claim` (M13 — no email cascade).
    - HS256-signed token → `auth/invalid-token` (C4).
    - `azp` mismatch → `auth/wrong-audience` (M9).
    - Rate-limited handshake → `auth/rate-limited` (M11).
    - `/health/live` 200 always; `/health/ready` 503 when JWKS
      unhealthy (M16).
    - `server:draining` broadcast on SIGTERM (M18).
    - **Signaling end-to-end (§9.2 `bootstrap.signal.integration.test.ts`):**
      two-client publish/receive, publisher excluded, late joiner,
      multi-tab no-dedup, rate limit (`max_publish_per_second_per_socket`).
    - **TURN credentials end-to-end (§9.2 `bootstrap.turn.integration.test.ts`):**
      ack shape, HMAC reproducibility, `turn.enabled = false` →
      handler absent.

12. **Dockerfile (M20), `.dockerignore`, scripts (M19, m7).**
    - Confirm the Dockerfile copies `apps/communication/config/` into
      both stages and sets `NODE_CONFIG_ENV=production` +
      `NODE_CONFIG_DIR=/app/config` (§8.16).
    - Add `HEALTHCHECK` directive (M20) targeting `/health/live`.
    - Document `docker run --read-only --tmpfs /tmp` (M20).
    - Build the image: `bash apps/communication/scripts/docker-build.sh`.
    - `docker run --rm --read-only --tmpfs /tmp -e PORT=4445 -e
      GOOGLE_OAUTH_CLIENT_ID=... -p 4445:4445 communication:local`.
    - `curl http://localhost:4445/health/live` returns `{ status:'ok' }`;
      `curl http://localhost:4445/health/ready` returns the JWKS health
      payload (M16); `curl /metrics` returns OpenMetrics text (M17).
    - **Important: the Docker image does NOT contain HAProxy or coturn.**
      Those are host-level installs handled by `install.sh` (step 12a).
      Operators who run the bare image get Fastify only — no edge
      routing, no TURN. Document this explicitly in
      `apps/communication/README.md` so an operator who sees `docker
      run` does not assume full functionality.
    - **Server provisioning — modular orchestrator + lib/ scripts (Part A).**
      Replaces the prior monolithic `install.sh` / `upgrade.sh` step.
      Create:
      - `scripts/install.sh` — orchestrator (local). Args
        `--ssh-host`, `--google-client-id`, `--cert-email`,
        `--no-haproxy`, `--domain`. Order per §15.7.
      - `scripts/upgrade.sh` — orchestrator (local). Args
        `--ssh-host`. Order per §15.7.
      - `scripts/lib/` sub-scripts as enumerated in §7.1 / §7.2:
        `common.sh`, `parse-args.sh`, `remote-run.sh`,
        `ensure-system-packages.sh`, `ensure-system-user.sh`,
        `ensure-repo-clone.sh`, `build-app.sh`,
        `generate-turn-secret.sh`, `render-toml-configs.sh`,
        `render-haproxy-cfg.sh`, `render-coturn-cfg.sh`,
        `render-systemd-unit.sh`, `render-renewal-hook.sh`,
        `render-journald-conf.sh`, `render-cert-expiry-timer.sh`,
        `obtain-letsencrypt-cert.sh`, `configure-ufw.sh`,
        `enable-systemd-services.sh`, `pull-repo.sh`,
        `install-deps.sh`, `graceful-restart.sh`, `smoke-test.sh`.
      - Each sub-script must pass `shellcheck`; each is unit-testable
        in isolation by running it locally with stub `apt`/`systemctl`/
        `ufw` (where feasible — at minimum a bash dry-run / shellcheck
        pass is required before merge).
      - Rendered systemd unit MUST include `LimitNOFILE=65536`,
        `Restart=always`, `RestartSec=5s`,
        `TimeoutStopSec=$((shutdown_grace_ms/1000+5))s`, and
        `EnvironmentFile=/etc/communication/turn-secret`.
        `certbot.timer` is enabled by `enable-systemd-services.sh`.
        `render-journald-conf.sh` drops
        `/etc/systemd/journald.conf.d/communication.conf` with
        `SystemMaxUse=2G` and `/etc/logrotate.d/coturn` with
        `rotate 3 daily compress`.
    - **`package.json` wrappers** for `server:install` /
      `server:upgrade` (already in §8.12) — pass-through to the
      orchestrators (`bash scripts/install.sh "$@"`).
    - **Bundle-hygiene script (m7):** add
      `scripts/assert-server-deps-not-in-browser-bundle.ts`. Wire it
      into the root `check-all`-equivalent script.

12a. **Edge networking — covered by the modular orchestrator (step 12).**
    The HAProxy + coturn + sslip.io + SAN cert provisioning is now
    fully realised by the sub-scripts under `scripts/lib/`
    (`render-haproxy-cfg.sh`, `render-coturn-cfg.sh`,
    `obtain-letsencrypt-cert.sh`, `render-renewal-hook.sh`,
    `configure-ufw.sh`, `enable-systemd-services.sh`,
    `smoke-test.sh`). See §15 for protocol-level detail and §15.7 for
    the orchestration model.

    **Smoke tests** owned by `smoke-test.sh`:
    - `curl --resolve <IP>.sslip.io:443:<IP>
      https://<IP>.sslip.io/health/live` returns `{ status: 'ok' }`.
    - `nc -zvu <IP> 3478` succeeds (STUN/TURN UDP listening).
    - `openssl s_client -connect turn-<IP>.sslip.io:443 -servername
      turn-<IP>.sslip.io` returns the SAN cert and shows coturn TLS
      handshake completes.
    - From a Socket.IO client (run from the operator machine via
      a scripted helper), emit `turn:request-credentials` and confirm
      the returned creds work against coturn (TURN ALLOCATE).

    **Fallback (`--no-haproxy`).** `configure-ufw.sh` + render-toml-
    configs.sh + render-coturn-cfg.sh handle the mode switch
    consistently. Smoke tests in this mode verify Fastify listens
    directly on `:443` and coturn TLS on `:5349` is reachable from
    the public internet.

13. **Root build pipeline wiring.**
    - Update root `moon.yml` `build` task to fan out to all
      `tag: application` projects (or chain `portfolio:build &&
      communication:build` until tag fan-out is wired).
    - Update root `package.json` `build` script accordingly.
    - `pnpm build` must build both `apps/portfolio` and
      `apps/communication`.

14. **Bundle hygiene verification (m7).**
    - Run `scripts/assert-server-deps-not-in-browser-bundle.ts`. The
      forbidden set is `['fastify','socket.io','engine.io',
      'socket.io-parser','jose','config','toml','prom-client',
      '@fastify/rate-limit']`. (`zod` is NOT asserted — it may
      legitimately ship to the browser if portfolio adopts it
      client-side.) Fix any offending dynamic `import()`.

15. **READMEs (M19 — operator/integrator-facing, ~150-300 lines).**
    - `apps/communication/README.md`: dev quickstart, prod deploy
      (one-liner: `bash apps/communication/scripts/install.sh
      --ssh-host root@1.2.3.4 --google-client-id <ID> --cert-email
      ops@example.com [--no-haproxy] [--domain <hostname>]`), Google
      OAuth client setup (link to Google Cloud console +
      `openid profile email` scopes + redirect URI), env-var table
      (`GOOGLE_OAUTH_CLIENT_ID`, `LOG_LEVEL`, `BUILD_*`,
      `TURN_SHARED_SECRET`, `TURN_REALM`, `TURN_TTL_SECONDS`,
      `TLS_*`, `EDGE_HAPROXY_ENABLED`), endpoint summary (`:443`
      Socket.IO via HAProxy → Fastify TLS on `127.0.0.1:8443`;
      `:3478` STUN/TURN; `:5349` TURNS via HAProxy in default mode,
      direct in `--no-haproxy` mode), protocol summary with one
      example per event (`command:initiate`, `signal:publish`,
      `turn:request-credentials`), §2 OAuth scope requirement (M13 —
      `name` claim REQUIRED, no email cascade), `local.toml`
      convention. Link to `server.md` for design rationale only.
      Document the file-name convention (M26 — file follows primary
      export, e.g. `IRoomRegistry.ts`).
      **Add new sections:**
      - "**Replaces apps/signaling.**" Note that v1 ships server-side
        only; v1.1 will migrate `apps/portfolio` retro/conf features
        off `apps/signaling` to this server. `apps/signaling` runs
        in parallel during the transition.
      - "**All connections require Google OIDC.**" State that the
        legacy anonymous-share-the-link UX is gone.
      - "**Required scopes:** `openid profile email`" (mirrors §2).
      - "**Endpoints:**"
        - WebSocket / Socket.IO under `<IP>.sslip.io:443` (HAProxy
          SNI passthrough → Fastify TLS on `127.0.0.1:8443`).
        - TURN: `turns:turn-<IP>.sslip.io:5349?transport=tcp`
          (HAProxy → coturn TLS) and
          `turn:turn-<IP>.sslip.io:3478?transport=udp` /
          `turn:turn-<IP>.sslip.io:3478?transport=tcp` (coturn
          direct, no HAProxy involvement).
      - "**Local dev:**" plain HTTP on `:4445`, no HAProxy, no
        coturn. `turn:request-credentials` returns `{ ok: false,
        error: 'internal' }` if no `TURN_SHARED_SECRET` is set;
        otherwise creds are issued but `urls` will be empty unless
        the developer pointed `[turn] urls = [...]` at a local
        coturn or a public test relay.
      - "**Docker image scope.**" Document that the Docker image
        contains Fastify only — HAProxy and coturn are host-level
        installs handled by `install.sh`. Operators running the bare
        image will not get TURN or edge routing.
    - Root `README.md`: add a one-line entry under whichever section
      mentions the existing services. Note that the new server
      replaces `apps/signaling` (server-side in v1; frontend
      migration in v1.1).

16. **`pnpm check-all` clean run.** Husky pre-commit hook will block
    otherwise.

---

## 15. Edge Networking (HAProxy + sslip.io + Let's Encrypt + coturn)

This section is the operational counterpart to the protocol spec
(§§6.Y, 6.Z) and the file-level scripts (§7.2 `install.sh`). It
documents the deployment topology that v1 ships with.

### 15.1 HAProxy in TCP mode + SNI passthrough

HAProxy on `:443` does NOT terminate TLS. It performs Layer-4 SNI
inspection — reads the unencrypted `ClientHello` SNI byte range — and
pipes the connection straight to the chosen backend. The actual
`haproxy.cfg` block rendered by `render-haproxy-cfg.sh`:

```
defaults
  mode tcp
  timeout connect 5s          # M13
  timeout client  1h          # M13
  timeout server  1h          # M13
  timeout tunnel  24h         # M13 — long-lived WebSocket / TURN sessions

frontend sni_router
  bind *:443
  mode tcp
  tcp-request inspect-delay 5s
  tcp-request content accept if { req.ssl_hello_type 1 }
  use_backend fastify if { req.ssl_sni -i -m str <IP>.sslip.io }      # M12 — exact match
  use_backend coturn  if { req.ssl_sni -i -m str turn-<IP>.sslip.io }  # M12 — exact match
  default_backend reject     # M12 — anything else gets dropped

backend fastify
  mode tcp
  server fastify 127.0.0.1:8443 send-proxy-v2   # C1 — original client IP carried to Fastify

backend coturn
  mode tcp
  server coturn 127.0.0.1:5349 send-proxy-v2    # C1 — coturn ≥ 4.5.2 supports PROXY proto

backend reject
  mode tcp
  tcp-request content reject  # M12 — silently drop unrecognised SNI
```

`<IP>` is templated by `render-haproxy-cfg.sh` from the host's public
IPv4 or the `--domain` value. The `-m str` ACL is exact-match (M12 —
supersedes the earlier `-m beg` / `-m end` pair, which let a forged
`turn-<IP>.foo.sslip.io` pass through as long as it ended in
`.sslip.io`).

**`default_backend reject`** (M12 — supersedes `default_backend
fastify`) drops connections whose SNI does not exactly match either
hostname. Unknown SNI is an attack indicator, not a fallback case.

### 15.2 sslip.io DNS

`sslip.io` is a public wildcard DNS service that resolves
`<anything>.<IP>.sslip.io` to `<IP>` automatically. Both
`<IP>.sslip.io` and `turn-<IP>.sslip.io` resolve to the host without
any DNS provisioning step. This is the standard pattern for personal
hosts and dev VMs — used widely by tools like Traefik and many
hobby deploys.

The plan does NOT depend on a custom domain. Operators who own a
domain can override `[turn] realm` and `[turn] urls` to point at it
instead — the protocol does not assume `sslip.io` specifically.

### 15.3 Let's Encrypt SAN cert

ONE certificate covers both hostnames via Subject Alternative Names:

```
sudo certbot certonly --standalone \
    -d <IP>.sslip.io \
    -d turn-<IP>.sslip.io \
    --cert-name communication \
    --email <CERT_EMAIL>
```

This produces:
- `/etc/letsencrypt/live/communication/fullchain.pem`
- `/etc/letsencrypt/live/communication/privkey.pem`

Both Fastify and coturn read the same files. Permissions on the
private key are set so the `communication` and `turnserver` users can
both read it; `obtain-letsencrypt-cert.sh` adds both to a `ssl-cert`
group and adjusts the file group ownership.

**First-boot ordering (C2).** `obtain-letsencrypt-cert.sh` runs BEFORE
`enable-systemd-services.sh`. No service binds `:80` at obtain-time;
certbot owns it during the standalone HTTP-01 challenge. UFW allows
`80/tcp` temporarily during the obtain step (the orchestrator opens
it, runs certbot, then `configure-ufw.sh` revokes it). The systemd
unit FILE is rendered earlier (`render-systemd-unit.sh`) but the
service is not started until after the cert exists — there is no
race between the unit referring to cert paths and the cert files
being written.

**Renewal.** `certbot.timer` runs `certbot renew` automatically.
Because both `<IP>.sslip.io` and `turn-<IP>.sslip.io` resolve to the
host, the standalone HTTP-01 challenge succeeds for both names in one
run.

**Renewal hook (M14 + M15 + v2)**
(`/etc/letsencrypt/renewal-hooks/deploy/communication.sh`):

```sh
#!/bin/sh
set -eu                                       # fail-fast (M15)
systemctl reload haproxy
systemctl reload coturn
# v2: communication auto-detects the cert change via fs.watch
# (CertWatcher) and refreshes its TLS context in place — no SIGTERM,
# no drain, active Socket.IO sessions stay live across renewals.
```

Decision (v2): `infrastructure/CertWatcher.ts` watches the cert + key
files on disk and calls `httpsServer.setSecureContext({ cert, key })`
whenever they change. Replaces the M14 2-phase SIGTERM drain so cert
renewals no longer drop active sessions.

`set -eu` is mandatory — NO `|| true` (M15). A failure in `systemctl
reload` exits non-zero so certbot retries on the next run; we do not
silently mask renewal-hook failures.
A separate systemd timer (`render-cert-expiry-timer.sh`) runs daily:
`openssl x509 -checkend $((7*86400)) -in fullchain.pem` — if the cert
expires within a week the timer logs a `warn` to journald (M15).

### 15.4 Fastify TLS

Fastify listens on `127.0.0.1:8443` with TLS in production
(`server.tls.enabled = true`, `cert_path` + `key_path` set). It is
NOT exposed to the public internet directly — UFW blocks `:8443/tcp`
externally; only `127.0.0.1` (where HAProxy is) can reach it.

**PROXY protocol v2 wrapper (C1).** When `[edge] haproxy_enabled =
true`, the bootstrap wraps the HTTPS server with a TCP-layer parser
that consumes the PROXY v2 header BEFORE TLS handshake, using the
`proxy-protocol-js` library (root deps). The parsed original client
IP is attached to each connection; Fastify is constructed with
`trustProxy: '127.0.0.1'` so it trusts loopback as the only PROXY
proto source. Parse failures increment
`communication_proxy_protocol_parse_failure_total` (§11.3) and the
connection is rejected. In `--no-haproxy` mode the wrapper is not
installed and Fastify reads `socket.remoteAddress` directly.

For local dev, `server.tls.enabled = false`; Fastify listens plain
HTTP on `:4445`. No HAProxy, no certs, no coturn, no PROXY proto. The
server is fully usable in dev — `turn:request-credentials` is the
only event that returns degraded responses.

The `[server] port` value reused as `8443` in production
TOML (configurable). Switching to direct-on-`:443` requires either
the `--no-haproxy` install flag (see §15.6) or manual port override.

### 15.5 coturn config (TLS hardening)

The full `turnserver.conf` rendered by `render-coturn-cfg.sh` (HAProxy
mode):

```
realm=turn-<IP>.sslip.io                                 # m7 — matches the issued URL host
use-auth-secret
static-auth-secret=<populated from /etc/communication/turn-secret>   # M11 — sourced via shell `. /etc/communication/turn-secret`
listening-port=3478
tls-listening-port=5349
listening-ip=127.0.0.1                                   # C3 — TURNS bound to loopback in HAProxy mode
cert=/etc/letsencrypt/live/communication/fullchain.pem
pkey=/etc/letsencrypt/live/communication/privkey.pem

# TLS hardening (M9)
no-tlsv1
no-tlsv1_1
cipher-list="ECDHE+AESGCM:ECDHE+CHACHA20:!aNULL:!MD5:!DSS"
ecdh-curve=prime256v1
dh-file=/etc/coturn/dhparam.pem
no-stun-backward-compatibility
no-tcp-relay

# denied-peer-ip — RFC1918 + link-local + IPv6 ULA + IPv6 link-local + carrier-grade NAT (M6)
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff
denied-peer-ip=fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff

# Logging (M10)
no-stdout-log
verbose=0
log-file=/var/log/coturn/turnserver.log

# PROXY protocol from HAProxy (C1)
proxy-protocol

fingerprint
no-multicast-peers
no-loopback-peers
no-cli

# Quotas (M7)
total-quota=100
user-quota=4
max-bps=2000000
```

- **`realm=turn-<IP>.sslip.io`** (m7) — matches the hostname used in
  the issued TURN `urls`.
- **`use-auth-secret`** — enables RFC 7635 / shared-secret auth.
- **`static-auth-secret`** (M11) — sourced from
  `/etc/communication/turn-secret` (chmod 640, owner
  `root:communication`) via the shell snippet
  `. /etc/communication/turn-secret`. The same value reaches the
  Communication server via the systemd `EnvironmentFile=` directive.
  Two consumers, ONE source of truth.
- **`listening-ip=127.0.0.1`** (C3) — in HAProxy mode, TURNS port
  5349 binds loopback only; HAProxy is the only allowed source. Plain
  TURN 3478 (UDP and TCP) stays on `0.0.0.0` because external clients
  hit it directly. Under `--no-haproxy`, both ports bind `0.0.0.0`.
- **TLS hardening (M9):** TLS 1.0 / 1.1 disabled; cipher list pinned
  to ECDHE-AESGCM/CHACHA20; `ecdh-curve=prime256v1`; mandatory DH
  parameters from `/etc/coturn/dhparam.pem` (generated by
  `obtain-letsencrypt-cert.sh`, idempotent).
  `no-stun-backward-compatibility` removes ancient STUN compat;
  `no-tcp-relay` disables the rarely-used TCP-to-TCP relay path.
- **`denied-peer-ip`** (M6 — mandatory) — RFC 1918 + link-local +
  IPv6 ULA + IPv6 link-local + carrier-grade NAT. Prevents using the
  relay as a pivot into private networks.
- **Logging (M10)** — `no-stdout-log`, `verbose=0`,
  `log-file=/var/log/coturn/turnserver.log`. Aggressive logrotate
  (`/etc/logrotate.d/coturn`, rendered by `render-journald-conf.sh`,
  `rotate 3 daily compress`) bounds retention of `userIdHash` records.
- **`proxy-protocol`** (C1) — coturn ≥ 4.5.2 accepts PROXY proto v2
  from HAProxy on its loopback listener so the original client IP is
  available for per-IP accounting.
- **`fingerprint`** — required for `RTCPeerConnection` interop.
- **Quotas (M7):** `total-quota=100` server-wide,
  `user-quota=4` per username (tightened from 12 — short-lived
  credentials make 4 concurrent allocations per user generous);
  `max-bps=2000000` ~2 Mbps per allocation.
- **`no-multicast-peers` / `no-loopback-peers` / `no-cli`** — standard
  hardening (no relay to multicast / loopback; no local CLI port).

### 15.6 Fallback when HAProxy not available

When `install.sh` is invoked with `--no-haproxy` (or
`INSTALL_NO_HAPROXY=1`), the topology degrades to direct ports:

- Fastify listens on `:443` (TLS) directly — overrides
  `[server] port = 8443` to `443` in the rendered production TOML.
  No PROXY protocol wrapper is installed (C1 — Fastify reads
  `socket.remoteAddress` directly).
- coturn TLS on `:5349/tcp` is reachable from the public internet
  (UFW allows it). `listening-ip=0.0.0.0` (C3 — supersedes the
  HAProxy-mode loopback bind).
- coturn plain TURN on `:3478/udp` and `:3478/tcp` reachable as
  before.
- TURN URLs become e.g.
  `turns:turn-<IP>.sslip.io:5349?transport=tcp` (M8 — note port
  `5349`, not `443`). `render-toml-configs.sh` templates the correct
  port based on the `--no-haproxy` flag.

**UFW rules in `--no-haproxy` mode (C3).** Allow `443/tcp` (Fastify),
`3478/udp`, `3478/tcp`, `5349/tcp` (coturn TLS), `22/tcp`. NEVER both
allow and deny `5349/tcp` — the rule is mode-conditional, not both.
HAProxy mode keeps `5349/tcp` denied externally because coturn is
loopback-bound.

**Same SAN cert covers both hostnames (m10).** Fastify and coturn
each read the same files
(`/etc/letsencrypt/live/communication/fullchain.pem` and
`privkey.pem`) and present the appropriate identity based on TLS SNI.
There is one cert with two SANs, not two certs.

Both modes are first-class: `EDGE_HAPROXY_ENABLED` env var (or
`[edge] haproxy_enabled` TOML key) records which mode the install
chose, and `render-toml-configs.sh` writes the `urls` and `port`
values consistently.

The HAProxy mode is preferred because it gives clients a single port
(`:443`) for both signaling and TURN — important when corporate
firewalls block non-443 traffic. `--no-haproxy` is documented as a
"if HAProxy is unavailable" escape hatch, not as a casual default.

### 15.7 Provisioning Orchestration

**Local orchestrator + remote sub-scripts.** The operator runs
`bash apps/communication/scripts/install.sh --ssh-host root@1.2.3.4
--google-client-id <ID> --cert-email ops@example.com` from their
laptop or a CI runner. The orchestrator:

1. Validates required args via `lib/parse-args.sh` (missing → usage,
   exit 2).
2. Rsyncs `lib/` to the target at
   `/tmp/communication-install-<timestamp>/` over ssh (single rsync
   call, preserves permissions).
3. For each step, runs
   `ssh $SSH_HOST "cd /tmp/... && env VAR1=... VAR2=... bash lib/<script>.sh"`.
4. Each sub-script is **idempotent** (skip-if-already-done) and uses
   `lib/common.sh` helpers (`info / ok / warn / die`) for consistent
   logging.
5. On any sub-script failure, the orchestrator stops and prints which
   step failed. NO `|| true` anywhere.
6. The operator sees a single human-readable progress trail spanning
   every sub-script.

**Order of operations in `install.sh`:**

1. `parse-args.sh` + validate required env.
2. Rsync `lib/` to target.
3. `ensure-system-packages.sh`.
4. `ensure-system-user.sh`.
5. `ensure-repo-clone.sh`.
6. `build-app.sh`.
7. `generate-turn-secret.sh` (idempotent — skip if file exists with
   non-empty content).
8. `render-toml-configs.sh` (templates IP from `curl -s ifconfig.me`
   on target, or literal when `--domain` provided).
9. `render-systemd-unit.sh` (cert files DO NOT exist yet — fine; the
   service is not started yet).
10. `render-renewal-hook.sh`.
11. `render-journald-conf.sh`.
12. `obtain-letsencrypt-cert.sh` (port 80 owned by certbot; HAProxy
    not yet started; ufw temporarily allows 80).
13. `render-haproxy-cfg.sh` (cert paths now exist).
14. `render-coturn-cfg.sh` (same).
15. `configure-ufw.sh` (final firewall rules; revoke 80).
16. `enable-systemd-services.sh` (in order: coturn → haproxy →
    communication; wait for `/health/live`).
17. `smoke-test.sh`.

**Order of operations in `upgrade.sh`:**

1. `parse-args.sh`.
2. Rsync `lib/` to target.
3. `pull-repo.sh`.
4. `install-deps.sh`.
5. `build-app.sh`.
6. `graceful-restart.sh`.
7. `smoke-test.sh`.

**SSH-based remote execution rationale.** The operator runs
`bash install.sh --ssh-host root@1.2.3.4 ...` from their laptop or a
CI runner. Single point of truth for parameters; each sub-script is
small and unit-testable in isolation; failures localize to a single
step. v2 may swap to Ansible if multi-node deploys arrive — the
modular structure already mirrors role-task organization.

---

## Rejected Alternatives (one-line rationale each)

- **Build communication into `apps/portfolio`'s server-side adjacent to
  Vite:** Vite is browser-first; mixing Node runtime there pollutes the
  app boundary. Rejected — separate `apps/communication` is the clean cut.
- **Reuse `apps/signaling`:** Different protocol (pub/sub vs.
  request/response), different lifecycle, no auth in signaling.
  Conflating them would ossify both. Rejected.
- **Drop Fastify, use raw `http.createServer` like signaling:** signaling
  has 3 endpoints. Communication grows `/metrics`, JSON parsing, CORS,
  structured logging — Fastify gives us those for free.
- **Use `tsx watch` for dev:** `node --watch
  --experimental-strip-types` is what `apps/signaling` uses today and
  ships with Node 22. Rejected.
- **Use dynamic Socket.IO namespaces (`/room/:uuid`):** §3 — heavier per-
  room cost, no isolation benefit we cannot get from `socket.to(...)`.
- **Validate Google ID tokens by calling Google's tokeninfo endpoint
  instead of locally via `jose`:** adds an external HTTP round-trip per
  handshake (latency + Google rate-limiting risk) and makes the server
  unable to authenticate during Google outages. Local JWKS-cached
  verification is the standard, recommended approach.
- **Re-validate the ID token on every `command:initiate`:** doubles the
  verification cost for a freshness benefit the per-connection lifecycle
  already provides. Rejected for v1; can be added behind a flag in v2.
- **Use Google's `name` claim as `displayName`:** the user spec says the
  client supplies `displayName`; using `name` would change the contract
  and surface PII the operator may not want logged. Rejected.
