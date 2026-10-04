# @frozik/transport

One Connect transport for the browser and the server to match it: HTTP/3
WebTransport first, a multiplexed WebSocket when UDP is out of reach, one
stream per call, backpressure end to end.

```ts
// browser — both protocols' addresses follow from the server's URL
const transport = createTransport({ serverUrl: 'https://chat.example' });
createClient(PlotService, transport);   // JSON
createClient(FileService, transport);   // binary protobuf where the messages carry bytes

// server
await startTransportServer({
  handlers: router.handlers, path, http3: { host, port },
  certificate,                 // { cert, key } or 'self-signed' for development
  websocket: { server },       // the HTTP(S) server already on the TCP port
  limits, admission: { allowedOrigins, maxSessionsPerIp, attemptsPerIpPerMinute, behindProxy },
  onError,
});
```

## Entry points

The package exports three halves, by environment:

| Path | Where | What |
| --- | --- | --- |
| `@frozik/transport/client/*` | browser, Node | `createTransport`, the connector, `createSessionTransport` |
| `@frozik/transport/server/*` | Node only (`"browser": null`) | `startTransportServer`, admission, context keys, listeners |
| `@frozik/transport/shared/*` | both | the session interface and the pinned-certificate contract |
| `@frozik/transport/testing/*` | tests | sessions joined in memory |

A browser bundler cannot resolve `server/*` at all — the export map refuses it
under the `browser` condition — and dependency-cruiser keeps `client/` from
reaching `server/` inside the package. The frame, tunnel, multiplexer and
codec modules are not exported; they are the package's own business.

## Layers

- `shared/session.ts` — `ITransportSession`, the subset of the WebTransport session
  API everything above relies on. Native `WebTransport`, the server sessions
  of fails-components and the WebSocket multiplexer all provide it.
- `frame/` — one HTTP-like exchange per bidirectional stream:
  `HEAD (JSON) · DATA* (bytes) · END (JSON)`, `[type u8][length u32][payload]`.
  Oversized frames, unknown types and broken order are rejected before
  anything is buffered.
- `tunnel/` — Connect's public universal layer over those frames: a
  `UniversalClientFn` for `@connectrpc/connect/protocol-connect`'s
  `createTransport`, and `serveConnectSession`, which feeds a router's
  `UniversalHandler`s. Connect itself is unchanged: envelopes, errors with
  details, trailers, deadlines and `readMaxBytes` all work as over HTTP.
- `codec/` — `usesBinaryCodec(method)`: binary protobuf when the method's
  messages (recursively) contain `bytes`, JSON otherwise.
- `mux/` — the WebSocket fallback. Streams over one socket with
  credit-based flow control: a receiver grants credit only after its consumer
  has read, a sender never sends past its credit, and a peer that does is a
  protocol violation that drops the socket — so the bytes buffered per stream
  never exceed the credit, whatever the peer does. The initial credit and the
  DATA size are protocol constants (`mux-limits.ts`); both ends must agree.
- `shared/pinned-certificate.ts` — development only: the path and JSON body
  under which a server without TLS publishes its self-signed certificate's
  hash and HTTP/3 port, read by the client before it connects.
- `client/` — the browser side: `createTransport` (addresses derived from the
  server URL by `endpoints.ts`), the `SessionConnector`
  (lazy session, HTTP/3 with a timeout, fallback, failure memory, reconnect
  after a drop, a forced mode), adapters for native WebTransport and the
  browser `WebSocket`.
- `server/` — Node only: an HTTP/3 listener on fails-components, the
  WebSocket listener on an existing HTTP(S) server (it shares the port with
  anything else on it, Socket.IO included), session admission (no foreign
  `Origin`, attempts and live sessions per address, no per-address limits for
  protocols behind a proxy), `TRANSPORT_CLIENT_ADDRESS` and
  `TRANSPORT_PROTOCOL` in each call's `context.values` (the address is
  undefined behind a proxy), and a self-signed certificate for development.
  dependency-cruiser keeps `client/` from reaching `server/`.
- `testing/` — a client and a server session joined in memory through the
  multiplexer; transport and backpressure tests run without a network.

## Backpressure, link by link

QUIC grants each stream a receive window; fails-components pulls from QUIC
only when the stream is read (with the patch below); the frame writer awaits
`writer.ready` and every write; Connect pulls request and response bodies as
async iterables. A handler that stops reading therefore stops the sender
within one window. Over the fallback the multiplexer's credits play QUIC's
part.

`server/backpressure.test.ts` runs three cases over real HTTP/3 and the real
WebSocket listener: a handler that does not read stops the client within one
window, a client that does not read stops the handler within one window, and
an echo the client does not read stops the client within two. Each bound is
the window plus a few messages in flight. `apps/communication` repeats the
last case through the real file service. Without the patch's backpressure
hunk all three fail on HTTP/3.

Towards the client the window is the client's own: the fails-components
client grows a stream window up to 6 MiB unless told otherwise, and browsers
choose theirs. Those bytes sit in the client, not in the server, so the tests
give their client the server's window to keep the bound meaningful.

## fails-components and its patch

`@fails-components/webtransport` (pinned in the catalog) is the only live
WebTransport server for Node; `node:quic` has no WebTransport. Three things
learned the hard way, all in `.claude/plan/2026-10-04-webtransport-rpc.md` §3.1:

- **Backpressure.** Unpatched, a stream nobody reads is drained into memory
  without limit — the pause flag was only computed with a pending pull and
  then ignored by the native side. `patches/@fails-components__webtransport@1.6.8.patch`
  calls `stopReading()` when the queue is full and always resolves the pull.
  The same patch passes the peer address to the session request callback.
- **Certificates.** `updateCert` does not reach the QUIC stack, so a new
  certificate restarts the HTTP/3 listener (`reloadCertificate`, serialised).
- **Server modes.** `reliability: 'both'` fails on session requests, so the
  HTTP/3 server runs alone; the fallback is ours, not the library's
  WebTransport-over-WebSocket, which lost the end of streams in Chromium.

The prebuilt binary needs glibc 2.38 or newer (Debian 13); it does not build
on Alpine.

### Upgrading it

The patch is keyed to the exact version, so a bump fails `pnpm install` until
someone decides; Dependabot sends `@fails-components/*` as a PR of its own.

1. Set the new version for both `@fails-components/*` entries in the catalog
   and drop the `patchedDependencies` line.
2. `pnpm install`, then `pnpm exec vitest run libs/transport/src/server/`.
   The backpressure test and every HTTP/3 session test are the verdict: the
   listener refuses sessions whose request carries no peer address, so a
   library that still omits it fails them all.
3. All green — upstream fixed both; delete the patch file and the entry in
   `.claude/rules/known-debt.md`. Otherwise `pnpm patch
   @fails-components/webtransport@<version>`, port the hunks,
   `pnpm patch-commit`, and run the tests again.
