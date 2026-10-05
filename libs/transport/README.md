# @frozik/transport

One Connect transport for the browser and the server to match it: HTTP/3
WebTransport first, a multiplexed WebSocket when UDP is out of reach, one
stream per call, backpressure end to end.

```ts
// browser — both protocols' addresses follow from the server's URL
const transport = createTransport({ serverUrl: 'https://chat.example' });
createClient(PlotService, transport);   // JSON
createClient(FileService, transport);   // binary protobuf where the messages carry bytes

// server (Node)
startTransportServer({
  handlers: router.handlers, path,
  websocket: { server },                 // the HTTP(S) server already on the TCP port
  gateway: { server: internal, secret }, // the HTTP/3 gateway's own listener
  limits, admission: { allowedOrigins, maxSessionsPerIp, attemptsPerIpPerMinute, behindProxy },
  onError,
});
```

HTTP/3 itself is terminated by a Go service,
[`apps/transport-gateway`](../../apps/transport-gateway/README.md), which opens
one multiplexed WebSocket to Node per browser session. Node therefore serves a
single kind of session — the multiplexer — on two listeners: the public one
for browsers on the fallback and the internal one for the gateway.

```
browser ─HTTP/3 (UDP)─▶ gateway (Go) ─WebSocket, frozik-mux.v1─▶ Node (gateway listener)
browser ─WebSocket (TCP) ───────────────────────────────────────▶ Node (public listener)
```

## Entry points

The package exports three halves, by environment:

| Path | Where | What |
| --- | --- | --- |
| `@frozik/transport/client/*` | browser, Node | `createTransport`, the connector, `createSessionTransport` |
| `@frozik/transport/server/*` | Node only (`"browser": null`) | `startTransportServer`, admission, context keys, listeners, the development certificate |
| `@frozik/transport/shared/*` | both | the session interface and the pinned-certificate contract |
| `@frozik/transport/testing/*` | tests | sessions joined in memory |

A browser bundler cannot resolve `server/*` at all — the export map refuses it
under the `browser` condition — and dependency-cruiser keeps `client/` from
reaching `server/` inside the package. The frame, tunnel, multiplexer and
codec modules are not exported; they are the package's own business.

## Layers

- `shared/session.ts` — `ITransportSession`, the subset of the WebTransport
  session API everything above relies on. Native `WebTransport` and the
  WebSocket multiplexer both provide it.
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
- `mux/` — many streams over one WebSocket with credit-based flow control: a
  receiver grants credit only after its consumer has read, a sender never
  sends past its credit, and a peer that does is a protocol violation that
  drops the socket — so the bytes buffered per stream never exceed the credit,
  whatever the peer does. The wire format, `frozik-mux.v1` (the WebSocket
  subprotocol), is specified in [`MUX.md`](MUX.md) and pinned by the vectors in
  `src/mux/mux-vectors.json`, which the TypeScript and the Go implementation
  both run.
- `shared/pinned-certificate.ts` — development only: the path and JSON body
  under which a server without TLS publishes the self-signed certificate's
  hash and the gateway's UDP port, read by the client before it connects.
- `client/` — the browser side: `createTransport` (addresses derived from the
  server URL by `endpoints.ts`), the `SessionConnector` (lazy session, HTTP/3
  counted only once a stream opens, within a timeout; fallback, failure
  memory, reconnect after a drop, a forced mode), adapters for native
  WebTransport and the browser `WebSocket`.
- `server/` — Node only: the WebSocket listener (`identify` says who asks),
  `gateway-identity.ts` (the gateway proves itself with the shared secret and
  the subprotocol; only then are its forwarded address and Origin believed —
  the public listener never reads those headers), session admission (no
  foreign `Origin`, attempts and live sessions per address, no per-address
  limits for protocols behind a proxy), `TRANSPORT_CLIENT_ADDRESS` and
  `TRANSPORT_PROTOCOL` in each call's `context.values` (`http3` for sessions
  through the gateway), and the development certificate the gateway serves.
- `testing/` — a client and a server session joined in memory through the
  multiplexer; transport and backpressure tests run without a network.

## Backpressure, link by link

The frame writer awaits `writer.ready` and every write; Connect pulls request
and response bodies as async iterables; the multiplexer grants credit only for
what was read. A handler that stops reading therefore stops the sender within
one window. Through the gateway the chain grows by two links: QUIC's flow
control between the browser and the gateway, and the gateway's copy loops,
which read from one side only once the other side took the previous bytes.

- `server/backpressure.test.ts` — over the real public listener and the
  gateway's listener: a handler that does not read stops the client within one
  window, a client that does not read stops the handler within one window, and
  an echo the client does not read stops the client within two.
- `apps/communication` — the last case through the real file service.
- `apps/transport-gateway` — the same over real HTTP/3, in-process (Go unit
  tests) and end to end against the real Node server (`transport-gateway:e2e`).

## Safari

Safari 26 (Apple's Network.framework) opens no WebTransport stream until the
server grants session flow-control credit and advertises the
`WT_INITIAL_MAX_*` settings (draft-13 and later). The gateway's
`webtransport-go` does both. The connector still counts an HTTP/3 session only
once a probe stream has opened, so any server that turns a session ready but
never grants a stream falls back to the WebSocket instead of hanging.
