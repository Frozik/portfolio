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

## Production deploy

### Prerequisites (operator's local machine)

The `install.sh` orchestrator runs **on your laptop / a CI runner**, not
on the target server. It SSH-s into the target and drives every step
remotely. You need:

1. A `git clone` of this repo somewhere local. Run the command from the
   repo root.
2. **At least one SSH public key** in `~/.ssh/*.pub` (e.g. `id_ed25519.pub`).
   If empty, generate one: `ssh-keygen -t ed25519 -C "you@example.com"`.
3. **Working SSH access to the target as `root` (or a sudoer)**. Either:
   - The hosting provider preinstalled your key (most cloud-init
     templates), OR
   - You logged in once with the provider's initial password and ran
     `ssh-copy-id root@<IP>`. Do this BEFORE invoking install.sh.
4. A **Google OAuth Client ID** (free; setup below).
5. `rsync`, `ssh`, and `bash` available locally.

### Run

```bash
bash apps/communication/scripts/install.sh \
  --ssh-host root@<IP> \
  --google-client-id <YOUR_CLIENT_ID>.apps.googleusercontent.com \
  --cert-email ops@example.com
```

| Flag                  | Required | Purpose                                                     |
| --------------------- | -------- | ----------------------------------------------------------- |
| `--ssh-host`          | yes      | SSH target, e.g. `root@1.2.3.4`                             |
| `--google-client-id`  | yes      | Google OAuth 2.0 Web Client ID (public, not a secret)       |
| `--cert-email`        | yes      | Email for Let's Encrypt notices                             |
| `--no-haproxy`        | no       | Disable HAProxy SNI router (coturn binds public TLS)        |
| `--no-redis`          | no       | Skip installing local redis-server (single-node deploys)    |
| `--no-harden-ssh`     | no       | Keep SSH password login enabled (default: disable)          |
| `--domain`            | no       | Override domain (default: `<IP>.sslip.io`)                  |
| `--cors-origin`       | no       | Add a CORS-allowed origin (repeatable; default `https://frozik.github.io,http://localhost:5173`) |

### What the orchestrator does

1. **rsyncs `lib/*.sh`** to `/tmp/communication-install-<TS>/` on the
   target.
2. **Stages every `~/.ssh/*.pub`** from your machine to
   `/tmp/communication-install-<TS>/operator-ssh-keys/`.
3. **`install-ssh-keys.sh`** appends each unique pub key to the target's
   `/root/.ssh/authorized_keys` (append-only; existing keys preserved).
4. **`disable-ssh-password-auth.sh`** writes
   `/etc/ssh/sshd_config.d/01-communication.conf` with
   `PasswordAuthentication no` + `PermitRootLogin prohibit-password`
   and reloads sshd. The `01-` prefix is load-bearing — Ubuntu
   cloud-init ships `50-cloud-init.conf` with `PasswordAuthentication
   yes`, and OpenSSH applies the FIRST match per option, so our
   drop-in must lex before it. Validated with `sshd -t` first; refuses
   to run if `authorized_keys` is empty. Skip via `--no-harden-ssh`
   if you need a password fallback (rare; not recommended).
5. **System packages, redis, system user, repo clone, build, secrets,
   configs, certbot, HAProxy/coturn render, UFW, services, smoke
   test** — see `scripts/install.sh` for the exact order.

Sub-scripts are idempotent. Re-running install.sh after a partial
failure is safe.

To upgrade an existing install:

```bash
bash apps/communication/scripts/upgrade.sh --ssh-host root@<IP>
```

Upgrade does: `git fetch + reset --hard origin/main` (force-push
resilient, with the install-rendered `production.toml` backed up
across the reset so its CORS / port / TURN URLs survive), `pnpm
install --frozen-lockfile`, build, `SIGTERM` + 16s drain, `start`,
smoke-test.

---

## Google OAuth client setup

The Client ID is the only Google-side artifact you need. It identifies
your application to Google when the browser redirects users to the
sign-in dialog. **It is public** — embedded in the frontend bundle and
passed to the server as a non-secret env var. (You can ignore the
"Client Secret" Google offers alongside; this app does not use server-
side OAuth code flow, only ID-token verification.)

### Step-by-step

1. **Open the Google Cloud Console**:
   <https://console.cloud.google.com/>. Sign in with the Google account
   you want to own this OAuth client.

2. **Create or select a project** (top-left dropdown). Any name works,
   e.g. `portfolio-communication`.

3. **OAuth consent screen** → left nav `APIs & Services` → `OAuth
   consent screen`:
   - User Type: `External` (unless you have Google Workspace).
   - App name: anything user-visible (e.g. `Portfolio`).
   - User support email + Developer contact email: your Gmail.
   - Scopes: leave default. `openid profile email` are added automatically
     for OpenID Connect; you do not need to declare them here.
   - Test users (while in Testing mode): add your own Gmail and any other
     accounts you want to grant access. Up to 100 emails.
   - Save and continue.

4. **Create credentials**: `APIs & Services` → `Credentials` →
   `Create Credentials` → `OAuth client ID`:
   - Application type: `Web application`.
   - Name: anything for you, e.g. `portfolio-web`.
   - **Authorized JavaScript origins** — these are mandatory:
     - `http://localhost:5173` (Vite dev server)
     - `https://frozik.github.io` (production GitHub Pages)
     - your custom domain if any
   - **Authorized redirect URIs**: leave empty. The frontend uses the
     Google Identity Services implicit ID-token flow, no redirect URI.
   - Click `Create`.

5. **Copy the Client ID**. It looks like:

   ```
   123456789012-abcdefghijklmnop.apps.googleusercontent.com
   ```

   You will pass this same string in three places:
   - `--google-client-id` flag of `install.sh` (server-side `aud` check).
   - `VITE_GOOGLE_OAUTH_CLIENT_ID` env var when building the portfolio
     (frontend identifies itself to Google).
   - `apps/portfolio/.env.local` for local dev.

6. **Publish the consent screen** (when ready for any Google user):
   `OAuth consent screen` → `Publish App`. Because we only use
   non-sensitive scopes (`openid profile email`), this transition is
   instant — no Google verification required.

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

### Step-by-step

1. **Open the Yandex OAuth console**: <https://oauth.yandex.com/>.
   Sign in with the Yandex account you want to own this OAuth client.

2. **Create a new app**:
   - Platform: select **Web services** (not "Mobile / Desktop").
   - **Suggest hostname** — production hostname of the deployment (no
     scheme, no path). For the GitHub Pages portfolio that is
     `frozik.github.io`.
   - **Redirect URI** — register all three. The path resolves to a
     React route inside the SPA (`<YandexOauthCallbackPage>`) that
     parses the OAuth fragment, posts it back to the opener, and
     closes the popup:
     - `http://localhost:5173/portfolio/oauth/yandex/callback`
     - `http://localhost:4173/portfolio/oauth/yandex/callback`
     - `https://frozik.github.io/portfolio/oauth/yandex/callback`
   - **Permissions** — `openid` is enough for sign-in. Adding
     `login:info` and `login:email` is optional and only adds richer
     profile fields to the issued JWT.

3. **Copy the Client ID and Client Secret** from the app's properties
   page. The client_id is public, the client_secret must be treated
   as a real secret.

   - Set `VITE_YANDEX_OAUTH_CLIENT_ID=<client_id>` in
     `apps/portfolio/.env.local` (already gitignored via `*.local`).
   - Pass the secret via `--yandex-client-secret <SECRET>` when
     running `install.sh`. The orchestrator writes it to
     `/etc/communication/oauth-secrets` (mode 600, owner
     `communication`) on the VPS — never to a TOML or any committed
     artifact.

4. **Validate**: after re-running `install.sh` with the new flags, the
   `<SignInGate>` shows two buttons (Google + Yandex). Yandex sign-in
   opens a popup, returns an opaque `access_token`, then the frontend
   exchanges it for a signed JWT via
   `https://login.yandex.ru/info?format=jwt`. The server verifies
   that JWT with `HS256` against `YANDEX_OAUTH_CLIENT_SECRET`.

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

## Operations

- **Graceful upgrade**: `bash apps/communication/scripts/upgrade.sh
  --ssh-host root@<IP>` — `SIGTERM` + 16s drain + start, smoke-tested.
- **Cert renewal**: handled by `certbot.timer` + hooks under
  `/etc/letsencrypt/renewal-hooks/`. `pre/open-http-port.sh` and
  `post/close-http-port.sh` toggle UFW for port 80 around the HTTP-01
  challenge (the firewall denies :80 the rest of the time — without
  these hooks renewals time out and the cert silently expires, which
  took the service down in Aug 2026). `deploy/communication.sh` reloads
  HAProxy and coturn; the Node service picks up the new cert in place
  via fs.watch (CertWatcher), so active sessions survive renewals.
- **Cert expiry alerts**: `communication-cert-check.timer` runs daily
  and warns to journald 7 days before expiry.
- **Live log level**:
  ```bash
  curl -X POST http://127.0.0.1:4446/admin/log-level \
    -H "authorization: Bearer $ADMIN_TOKEN" \
    -d '{"level":"debug"}'
  ```

### PROXY protocol — currently OFF

HAProxy's `send-proxy-v2` is intentionally **disabled** on both backends
(see `scripts/lib/render-haproxy-cfg.sh`). The Fastify side does not yet
parse the PROXY protocol v2 header — wiring it through
`proxy-protocol-js` in `bootstrap.ts` is on the deferred list.

**Operational consequence:** the Node service sees every incoming
connection as originating from `127.0.0.1` (HAProxy's loopback to the
backend). `@fastify/rate-limit` is keyed by request IP, so the per-IP
ceiling effectively becomes a **single global ceiling** for the whole
process — one misbehaving client can starve everyone else's handshake
budget. Acceptable trade-off for a personal-scale portfolio deploy;
revisit if abuse becomes visible (`communication_handshake_rate_limited_total`
gauge spiking).

---

## Troubleshooting

| Symptom                                              | Where to look                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Handshakes fail with `auth/jwks-unreachable`         | `/health/ready` returns 503; `communication_jwks_consecutive_failures`   |
| TURN credentials always rejected                     | NTP / clock skew — `timedatectl status`                                  |
| `auth/missing-name-claim` on every connect           | Client did not request `profile` scope                                   |
| HAProxy refuses to start                             | `haproxy -c -f /etc/haproxy/haproxy.cfg`                                 |
| TLS cert expiry                                      | `journalctl -u communication-cert-check.service -n 50`                   |
| Metrics empty                                        | `curl http://127.0.0.1:4445/metrics`                                     |

---

## DNS dependencies

The default deploy uses [`sslip.io`](https://sslip.io) — a free third-party
wildcard DNS service that resolves `<IP>.sslip.io` to `<IP>` without any
registrar setup. This is convenient for personal portfolio demos but it is
**not appropriate for production traffic**:

- `sslip.io` is operated as a courtesy; it can go down without notice.
- A failed lookup blocks Let's Encrypt issuance entirely.
- Production deploys should configure a real domain with proper DNS.

`obtain-letsencrypt-cert.sh` performs a DNS sanity check before invoking
`certbot` and aborts with an actionable error when resolution fails. To
switch to a real domain, create an A record pointing at the server's
public IP and re-run `install.sh` with `--domain my.example.com`.

---

The source tree under `src/` follows DDD layers (`domain/`,
`application/`, `infrastructure/`, `presentation/`) — read
`presentation/bootstrap.ts` to see the composition root, or
`infrastructure/verifier-registry.ts` to see how a third OIDC provider
would slot in.
