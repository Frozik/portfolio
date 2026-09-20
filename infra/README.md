# infra

Everything that knows about the production machine: how to provision it, how
to deploy to it, and how to operate it. The application itself knows none of
this — see [`apps/communication`](../apps/communication/README.md).

One host runs the signaling stack: HAProxy terminates :443 and routes by SNI,
coturn relays TURN, certbot keeps the certificate fresh, and the Node service
plus its Redis run as containers pulled from GHCR. Nothing is built on the box.

## Layout

```
hosts/   the inventory — one env file per machine
bin/     what a human runs
lib/     plumbing for the scripts themselves (ssh multiplexing, args, inventory, logging)
roles/   grouped by the component being configured
  edge/            haproxy, coturn, certbot, firewall, ssh hardening, journald
  communication/   docker, secrets, config, compose, deploy user, smoke test
```

## The inventory

Machines are declared in `hosts/<name>.env` as plain `KEY=VALUE` — deliberately
dumber than an Ansible inventory, so the values a human reads are the ones the
scripts source, with no parser in between. **No secrets live here**: the Yandex
client_secret and the TURN secret exist only on the machine itself, in
`/etc/communication/` at mode 600.

```bash
pnpm hosts                 # what is declared
pnpm hosts -- --check      # plus what each machine reports: kernel, uptime,
                           # disk, the commit actually deployed, cert expiry
```

Every command takes `--host <name>` instead of a raw IP:

```bash
bash infra/bin/deploy-communication.sh --host production
bash infra/bin/provision-host.sh --host production --cert-email you@example.com
```

An explicit flag always wins over the file, so `--host production --domain
other.example` works for a one-off.

**The portfolio build reads the same files.** `VITE_COMMUNICATION_URL` and the
OAuth client ids used to be duplicated in `apps/portfolio/.env.production` and
`.env.local`; both are gone. `vite-plugins/deployment-target.ts` derives them
from `hosts/<name>.env`, so rotating an OAuth client is a one-line edit here
rather than three edits that silently drift apart. `DEPLOY_HOST_NAME` picks a
different host, `VITE_COMMUNICATION_URL` still overrides the URL for a local
backend.

A role step is invoked as `remote_run_script <role>/<step>`; `bin/` scripts
rsync `lib/` and `roles/` to the target and run the steps over one multiplexed
SSH connection.

## Checks

`pnpm shellcheck` (part of `pnpm check-all`, and of `moon ci`) runs shellcheck
across every script here.

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
bash infra/bin/provision-host.sh \
  --host production \
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

1. **rsyncs `lib/` and `roles/`** to `/tmp/communication-install-<TS>/` on
   the target, preserving the layout the role steps expect.
2. **Stages every `~/.ssh/*.pub`** from your machine to
   `/tmp/communication-install-<TS>/operator-ssh-keys/`.
3. **`roles/edge/ssh-keys.sh`** appends each unique pub key to the target's
   `/root/.ssh/authorized_keys` (append-only; existing keys preserved).
4. **`roles/edge/ssh-hardening.sh`** writes
   `/etc/ssh/sshd_config.d/01-communication.conf` with
   `PasswordAuthentication no` + `PermitRootLogin prohibit-password`
   and reloads sshd. The `01-` prefix is load-bearing — Ubuntu
   cloud-init ships `50-cloud-init.conf` with `PasswordAuthentication
   yes`, and OpenSSH applies the FIRST match per option, so our
   drop-in must lex before it. Validated with `sshd -t` first; refuses
   to run if `authorized_keys` is empty. Skip via `--no-harden-ssh`
   if you need a password fallback (rare; not recommended).
5. **System packages, Docker Engine, secrets, rendered config, certbot,
   HAProxy/coturn render, UFW, host services, `docker compose up`, the
   deploy user, smoke test** — see `bin/provision-host.sh` for the exact
   order.

Role steps are idempotent. Re-running after a partial failure is safe.

To deploy a new version:

```bash
bash infra/bin/deploy-communication.sh --host production
```

It pulls the published image and runs `docker compose up -d`, which sends
SIGTERM to the old container, waits out `stop_grace_period` (20 s) so active
calls drain, starts the new one, then smoke-tests. To pin an exact build —
this is also how you roll back — set the tag:

```bash
COMMUNICATION_TAG=<commit-sha> bash infra/bin/deploy-communication.sh --host production
```

Neither command is needed for a routine release: pushing to `main` deploys.
`.github/workflows/deploy-communication.yml` waits for CI to go green, asks the
box which commit it is running, and rolls out only when that range actually
touches the server (`pnpm exec affected-projects`).

---

## Google OAuth client setup

Token rules the server enforces are documented in the app README; the console
walkthrough is here.

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
   - nowhere else: the browser bundle reads the same `hosts/<name>.env`
     through `apps/portfolio/vite-plugins/deployment-target.ts`.

6. **Publish the consent screen** (when ready for any Google user):
   `OAuth consent screen` → `Publish App`. Because we only use
   non-sensitive scopes (`openid profile email`), this transition is
   instant — no Google verification required.

## Yandex OAuth setup (optional)

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
     `infra/hosts/<name>.env` — the one place both the server and the
     browser bundle read it from.
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

## Operations

- **Graceful upgrade**: `bash infra/bin/deploy-communication.sh
  --host production` — `docker compose up -d`, 20 s drain, smoke-tested.
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
(see `roles/edge/haproxy.sh`). The Fastify side does not yet
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
