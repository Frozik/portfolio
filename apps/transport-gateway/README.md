# transport-gateway

The HTTP/3 side of the [transport demo](../portfolio/src/features/transport/README.md):
a small Go service on [quic-go/webtransport-go](https://github.com/quic-go/webtransport-go)
that terminates WebTransport on UDP and bridges every browser session onto one
multiplexed WebSocket to the Node server ([`apps/communication`](../communication/README.md)).
Node serves the Connect services; the gateway never reads a byte of them.

```
browser ─HTTP/3 (UDP 443)─▶ gateway ─WebSocket, frozik-mux.v1─▶ Node :4448 (compose network only)
```

**Why a gateway.** The Node WebTransport server (fails-components) speaks an
older draft: Safari 26 waits for session flow-control credit it never sends
and opens no stream. webtransport-go implements draft-16 flow control and the
settings Safari needs (`WT_MAX_SESSIONS`, `WT_INITIAL_MAX_*` — only sent with a
non-nil `Config`). Node keeps one kind of session, the multiplexer it already
served for the WebSocket fallback, and lost a patched native dependency.

## How a session goes

1. A browser sends the WebTransport CONNECT for `/transport`.
2. The gateway dials Node's gateway listener with `Authorization: Bearer
   <TRANSPORT_GATEWAY_SECRET>`, the browser's address in
   `X-Transport-Client-Address`, its `Origin`, and the `frozik-mux.v1`
   subprotocol. **Node decides admission** (Origin allow-list, per-address
   sessions and attempts); a refusal is answered to the CONNECT with Node's
   status, before any WebTransport session exists.
3. Accepted: the session is upgraded and every browser stream becomes one mux
   stream, byte for byte. FIN maps to FIN; a reset on either side resets both.
   When either session ends, the other is closed.

**Backpressure.** Nothing queues: the copy loop reads from one side only once
the other side took the previous bytes. The mux credit (256 KiB per stream)
stops reads from QUIC, so the browser stops at QUIC's flow control; QUIC's
flow control stops reads from the mux, so Node's handler stops at the credit.
Per stream the gateway holds one copy buffer each way and at most the credit
it granted.

## Layout

| Package | What |
| --- | --- |
| `cmd/gateway` | wiring, graceful drain on SIGTERM, `-healthcheck` |
| `internal/config` | the environment, read and validated once |
| `internal/certs` | the TLS pair from files, re-read when they change (Let's Encrypt renewals, the development certificate) |
| `internal/mux` | the `frozik-mux.v1` protocol ([`libs/transport`](../../libs/transport/README.md#multiplexer-protocol-frozik-muxv1)), both roles |
| `internal/upstream` | the dial to Node with the secret, address and Origin |
| `internal/bridge` | one WebTransport session ⇄ one mux session |
| `internal/server` | the HTTP/3 server, the CONNECT handler, live-session accounting for drain |
| `internal/metrics` | Prometheus: sessions, refusals by status, streams, bytes by direction |
| `e2e` | against the real Node server (build tag `e2e`) |

## Configuration (environment)

| Variable | Default | |
| --- | --- | --- |
| `GATEWAY_UPSTREAM_URL` | — | Node's gateway listener, `ws://communication:4448/transport` in compose |
| `TRANSPORT_GATEWAY_SECRET` | — | shared with Node, ≥ 16 characters |
| `GATEWAY_CERT_FILE`, `GATEWAY_KEY_FILE` | — | PEM files; the gateway waits for them to appear |
| `GATEWAY_LISTEN_ADDR` | `:4447` | UDP |
| `GATEWAY_PATH` | `/transport` | |
| `GATEWAY_MAX_STREAMS_PER_SESSION` | `16` | as Node's `max_streams_per_session` |
| `GATEWAY_STREAM_WINDOW_BYTES` / `GATEWAY_SESSION_WINDOW_BYTES` | 256 KiB / 1 MiB | QUIC receive windows, auto-tuning off |
| `GATEWAY_CERT_RELOAD_INTERVAL` | `30s` | how often the certificate files are checked |
| `GATEWAY_IDLE_TIMEOUT` | `30s` | a connection silent this long is closed and its upstream session freed |
| `GATEWAY_ADMIN_ADDR` | `127.0.0.1:9447` | `/metrics`, `/healthz`; never published |
| `GATEWAY_DRAIN_TIMEOUT` | `15s` | below compose's `stop_grace_period` (20 s) |

## Running

- **Tests**: `pnpm exec moon run transport-gateway:test` (unit, with `-race`;
  the codec runs the shared vectors of `libs/transport/src/mux/mux-vectors.json`)
  and `transport-gateway:e2e` (starts Node from its sources). Moon installs Go
  1.26 through proto; nothing to install by hand.
- **Development**: `pnpm dev` in `apps/communication` starts this gateway from
  `compose.dev.yml` (Docker), serving the certificate Node writes to
  `apps/communication/.dev-certs`.
- **Production**: the `gateway` service of
  `apps/communication/deploy/docker-compose.yml`, image
  `ghcr.io/frozik/transport-gateway:<commit>`, published on UDP 443, running as
  uid 1001 to read the Let's Encrypt files. CI builds it with the communication
  image for every commit on `main`, and `Deploy communication` rolls out both.
