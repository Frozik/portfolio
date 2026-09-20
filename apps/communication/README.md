# @frozik/communication

Socket.IO command/response relay + WebRTC signaling + ephemeral TURN
credentials, with Google Sign-In (OIDC) auth on the handshake.

This server replaced the legacy `apps/signaling/` deployment. It keeps
the WebSocket transport (Socket.IO 4.x), adds OIDC-protected handshakes
(Google and Yandex via a pluggable `IIdentityVerifier` strategy), a
typed command/response protocol, and ephemeral coturn credentials.
Anonymous (optional-auth) sessions can also obtain TURN credentials —
conference rooms work without sign-in — but with a shorter relay window
(`turn.anonymous_ttl_seconds`, default 600 s) on top of the per-socket
request limits and coturn quotas. The portfolio frontend (`retro` and
`conf` features) signals exclusively through this server.

---

## Dev quickstart

```bash
pnpm install
pnpm --filter @frozik/communication dev
```

- Loads `config/default.toml` overlaid with `config/development.toml`.
- Listens on `http://0.0.0.0:4445` (TLS off in dev).
- Admin port `4446` listens on `127.0.0.1` for `POST /admin/log-level`.
- No Google Client ID required for the dev preset (auth is bypassed via
  the `development` config — never enable that in production).

---

## Google OAuth client setup

The Client ID is the only Google-side artifact you need. It identifies
your application to Google when the browser redirects users to the
sign-in dialog. **It is public** — embedded in the frontend bundle and
passed to the server as a non-secret env var. (You can ignore the
"Client Secret" Google offers alongside; this app does not use server-
side OAuth code flow, only ID-token verification.)

### Token rules the server enforces

- `iss` must be `https://accounts.google.com` or `accounts.google.com`.
- `aud` must equal `--google-client-id`.
- `azp` (if present) must equal `--google-client-id`.
- `alg` is pinned to RS256.
- `name` claim is required — the server uses it as the public display
  name; without it the handshake fails with
  `auth/missing-name-claim`. (We deliberately do not fall back to
  `email`, so users joining a room never broadcast their address to
  other participants.)
- On refresh: `sub` stable, `iat` monotonic, `sid` (if present)
  stable.

If the frontend Client ID and the server's `--google-client-id` differ,
handshake fails with `auth/wrong-audience`. Use the same string everywhere.

### Long-lived sessions

Google ID tokens are valid for one hour. To keep a retro / conf tab
usable past that without a sign-in popup, the app silently asks
Google for a fresh token in the background a minute before expiry.
This works only when the current page origin is in the OAuth client's
"Authorized JavaScript origins" (step 4 above) — if it is missing,
the silent refresh is rejected and the user is signed out at the hour
mark. New origins take about five minutes to propagate.

---

## Yandex OAuth setup (optional)

The communication server can also accept Yandex-issued tokens. Set up
is parallel to Google; the Yandex sign-in button stays hidden in the
frontend and the server rejects `provider: 'yandex'` handshakes when
either of the two Yandex env vars below is empty.

### Token rules the server enforces (Yandex)

- `iss` must equal `login.yandex.ru`.
- `alg` is pinned to `HS256` (the only algorithm Yandex's `/info` uses).
- `uid` must be present and non-empty — surfaced as `userId =
  yandex:${uid}` so it cannot collide with a Google `sub`.

If the JWT signature does not match the configured client_secret the
handshake fails with `auth/invalid-token`.

---

## Environment variables

Configuration is layered: `default.toml` -> `<NODE_CONFIG_ENV>.toml` ->
env vars (mapped via `config/custom-environment-variables.json`).

| Env var                          | TOML path                       | Notes                              |
| -------------------------------- | ------------------------------- | ---------------------------------- |
| `PORT`                           | `server.port`                   | Default 4445                       |
| `TLS_ENABLED`                    | `server.tls.enabled`            | `true` in production               |
| `TLS_CERT_PATH`                  | `server.tls.cert_path`          | `/etc/letsencrypt/live/...`        |
| `TLS_KEY_PATH`                   | `server.tls.key_path`           |                                    |
| `GOOGLE_OAUTH_CLIENT_ID`         | `auth.google_oauth_client_id`   | **Required**                       |
| `YANDEX_OAUTH_CLIENT_ID`         | `auth.yandex_oauth_client_id`   | Optional — required for Yandex sign-in |
| `YANDEX_OAUTH_CLIENT_SECRET`     | `auth.yandex_oauth_client_secret` | Optional, **secret** — sourced via systemd EnvironmentFile |
| `JWKS_FETCH_MAX_ATTEMPTS`        | `auth.jwks.fetch_max_attempts`  |                                    |
| `JWKS_FETCH_TIMEOUT_MS`          | `auth.jwks.fetch_timeout_ms`    |                                    |
| `TURN_SHARED_SECRET`             | `turn.shared_secret`            | **Required**, sourced via systemd  |
| `TURN_REALM`                     | `turn.realm`                    | Set by `render-toml-configs.sh`    |
| `TURN_TTL_SECONDS`               | `turn.ttl_seconds`              | Default 43200 (12h)                |
| `EDGE_HAPROXY_ENABLED`           | `edge.haproxy_enabled`          | `true` in production               |
| `LOG_LEVEL`                      | `logging.level`                 | `trace`/`debug`/`info`/`warn`/...  |
| `BUILD_ID`, `BUILD_COMMIT`, `BUILD_VERSION` | `build.*`            | Stamped at build time              |
| `ADMIN_TOKEN`                    | `admin.token`                   | Bearer for `/admin/log-level`      |

---

## Endpoints

| Where                                  | Purpose                                                |
| -------------------------------------- | ------------------------------------------------------ |
| `:443/socket.io/...`                   | HAProxy SNI -> Fastify -> Socket.IO (production)       |
| `:3478/udp` + `:3478/tcp`              | coturn STUN/TURN (plain)                               |
| `:5349/tls` (HAProxy mode: SNI on :443)| coturn TURNS (TLS-wrapped TURN)                        |
| `:4445`                                | Fastify direct (dev / inside container)                |
| `:4446/admin/log-level`                | Admin port — **localhost-only**                        |
| `/health/live`                         | Liveness probe (always 200 once started)               |
| `/health/ready`                        | Readiness — 503 while JWKS unreachable                 |
| `/metrics`                             | Prometheus exposition                                  |

In HAProxy mode all WSS *and* TURNS terminate on `:443`; the SNI router
demultiplexes by hostname (`<IP>.sslip.io` -> Fastify, `turn-<IP>.sslip.io`
-> coturn). With `--no-haproxy`, Fastify owns `:443` directly and coturn
runs TURNS on `:5349`.

---

## Protocol summary

Authenticate at the Socket.IO handshake by sending the room id, the
provider discriminator (`'google'` or `'yandex'`), and the
provider-issued JWT in the `auth` payload:

```ts
const socket = io('wss://<IP>.sslip.io', {
  auth: {
    roomId: '11111111-2222-4333-8444-555555555555',
    provider: 'google', // or 'yandex'
    token: jwt,
  },
});
```

The server routes the token to the matching `IIdentityVerifier`
implementation. Google JWTs are verified offline against Google's
JWKS (RS256); Yandex JWTs are verified offline with `HS256` against
the configured `YANDEX_OAUTH_CLIENT_SECRET`. Either way, the
downstream protocol is identical from this point on.

Three top-level message families:

```ts
// 1. Command / response relay (initiator → server → other room sockets)
socket.emit(
  'command:initiate',
  { command, payload, correlationId },
  (ack) => {
    // ack: { socketCount, users: [{ userId, displayName }], correlationId }
  },
);
socket.on('command:execute', (event, respond) => {
  // event: { command, payload, correlationId, initiator: { userId, displayName, socketId } }
  respond({ payload: '...', correlationId: event.correlationId });
});
socket.on('command:response', (event) => {
  // event: { kind: 'success' | 'timeout' | 'responder-disconnected' | 'dispatch-rejected',
  //          correlationId, responder?, payload?, reason? }
});

// 2. WebRTC signaling — opaque pub/sub, server adds `from`
socket.emit('signal:publish', { payload, correlationId }, (ack) => {
  // ack: { ok: true, recipientCount } | { ok: false, error }
});
socket.on('signal:event', (event) => {
  // event: { payload, from: { userId, displayName, socketId }, correlationId? }
});

// 3. Ephemeral TURN credentials (HMAC-SHA1, server-issued)
socket.emit('turn:request-credentials', undefined, (ack) => {
  // ack: { username, credential, ttl, urls }
});
```

---

## OAuth scope requirement

The server only reads two claims from the verified token:

- A stable user identifier — Google's `sub` or Yandex' `uid`. The
  identifier is namespaced by provider on the server side
  (`google:<sub>`, `yandex:<uid>`) so cross-provider collisions are
  impossible by construction.
- A non-empty `name` claim, used as the public display name. Missing
  → handshake rejected with `auth/missing-name-claim`.

Both providers include these by default in the standard OpenID Connect
scopes (`openid profile`). The `email` scope is requested for future
features but is never used to derive the display name — emails would
otherwise broadcast to every room participant.

---

## Migration history

The legacy `apps/signaling/` deployment has been decommissioned. The
v1.1 frontend migration moved retro + conf onto this server (Google
OIDC sign-in, custom `SignalingConn` adapter for `y-webrtc`,
`auth:refresh-token` loop, `turn:request-credentials` plumbing). v1.2
removed the legacy server source tree.

---

---

Provisioning the production host, deploying, operations and troubleshooting
live in [`infra/README.md`](../../infra/README.md).
