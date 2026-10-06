# @frozik/transport

One Connect transport for the browser and the server to match it: HTTP/3
WebTransport first, a multiplexed WebSocket when UDP is out of reach, one
stream per call, backpressure end to end.

```ts
// browser — both protocols' addresses follow from the server's URL
const transport = createTransport({ serverUrl: 'https://chat.example' });
createClient(PlotService, transport);   // binary protobuf
createClient(FileService, transport);

// debugging: JSON where the messages carry no bytes, readable WebSocket messages
createTransport({ serverUrl, wireFormat: 'json' });
transport.setWireFormat('json');         // or switch a live transport

// every call sends a W3C Trace Context `traceparent`; a failed call's id for the UI
traceIdOf(error);

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
- `shared/trace-context.ts` — W3C Trace Context `traceparent`: parse, format, new trace;
  the `TRANSPORT_TRACE` context key.
- `shared/wire-format.ts` — `WireFormat`: `binary` (the default) or `json`,
  the debugging format.
- `codec/` — `usesBinaryCodec(method, format)`: binary protobuf on the binary
  format; on the JSON format still binary when the method's messages
  (recursively) contain `bytes`, JSON otherwise.
- `mux/` — many streams over one WebSocket with credit-based flow control: a
  receiver grants credit only after its consumer has read, a sender never
  sends past its credit, and a peer that does is a protocol violation that
  drops the socket — so the bytes buffered per stream never exceed the credit,
  whatever the peer does. The wire format, `frozik-mux.v1` (the WebSocket
  subprotocol), is specified [below](#multiplexer-protocol-frozik-muxv1) and pinned by the vectors in
  `src/mux/mux-vectors.json`, which the TypeScript and the Go implementation
  both run. `mux-wire.ts` holds the two wires: that one, and
  `frozik-mux-json.v1`, where control messages and DATA that reads as JSON
  (`readable-frames.ts`: HEAD, END, JSON bodies, Connect envelopes of JSON)
  travel as text messages and only the rest as binary ones — the browser asks
  for it on the JSON format, the gateway never speaks it.
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

## Multiplexer protocol, `frozik-mux.v1`

Many byte streams over one WebSocket, each with its own flow control. The
browser speaks it when HTTP/3 is unreachable; the HTTP/3 gateway speaks it to
Node for every WebTransport session. Two implementations exist —
`src/mux/` (TypeScript) and `apps/transport-gateway/internal/mux` (Go) — and
both run the shared vectors in `src/mux/mux-vectors.json`. A change to this section is a
change to both and to the vectors.

The same protocol has a second, readable wire for debugging,
`frozik-mux-json.v1` ([below](#json-wire-frozik-mux-jsonv1)). Only the browser
and Node speak it; the gateway never does.

### Connection

- A WebSocket with the subprotocol `frozik-mux.v1`. Admission happens at the
  HTTP upgrade (`403` when refused); there is no handshake after it, and the
  session is usable as soon as the socket is open.
- Every mux message is exactly one **binary** WebSocket message; the message
  boundary is the frame boundary, there is no length prefix. A text message is
  a protocol violation.
- Close codes: `1000` normal end; `4002` protocol violation (the reason names
  it). Closing the socket fails every open stream in both directions.

### Messages

Big-endian. A 5-byte header, then a payload whose shape depends on the type.

| Byte | Field |
| --- | --- |
| 0 | `u8` type |
| 1–4 | `u32` stream id |

| Type | Name | Payload |
| --- | --- | --- |
| 1 | OPEN | none |
| 2 | DATA | 0 – 65 536 bytes |
| 3 | FIN | none |
| 4 | RESET | none |
| 5 | CREDIT | `u32` — bytes newly granted (a delta, not an offset) |

Any other type, a payload where none belongs, a CREDIT payload that is not
four bytes, or DATA over 65 536 bytes is a violation.

### Streams

- The client (the side that opened the WebSocket) opens **odd** ids, the
  server **even** ids, starting at 1 and 2 and stepping by 2; ids are never
  reused. A stream exists from its OPEN; DATA may follow immediately.
- OPEN with id 0, with the receiver's own parity or with a live id is a
  violation. Past the receiver's limit of live incoming streams, it answers
  RESET for that id and the session goes on. The browser and the gateway
  accept no incoming streams; Node never opens any.
- DATA, FIN, CREDIT or RESET for an id that is not live is ignored: messages
  for a stream that was just reset may still be in flight.
- **FIN** ends the sender's direction (a half-close). A second FIN is ignored;
  DATA after FIN is a violation.
- **RESET** aborts both directions. The receiver fails the stream and does not
  answer with a RESET of its own. RESET carries no error code.
- A stream is released once both directions have ended: this side sent FIN
  (or RESET) and the peer's FIN (or RESET) arrived — whether or not the
  consumer has read to the end. A reader that stops at its own end marker (a
  Connect handler at its END frame) must not keep the slot.

### Flow control

- Per stream, per direction; there is no session-wide window.
- Each stream starts with **262 144 bytes** of credit in each direction. The
  number is part of the protocol: both ends must assume it without exchanging it.
- A sender never sends DATA beyond its remaining credit; it splits writes into
  DATA of at most `min(remaining bytes, credit, 65 536)` and waits when credit
  is zero.
- A receiver grants credit only for bytes its consumer has **read**, in CREDIT
  messages of at least 131 072 bytes (half the initial window). Granting before
  the data is consumed would defeat the backpressure.
- Receiving more DATA than granted is a violation: the receiver closes the
  socket with `4002`. So the bytes a receiver holds per stream never exceed
  262 144, whatever the peer does.
- Control messages (OPEN, FIN, RESET, CREDIT) are never held back by credit.

### Payload

The mux is byte-transparent. On top of it each stream carries one Connect call
in the frame protocol of `src/frame/` (`HEAD · DATA* · END`), which only the
endpoints parse; the gateway forwards bytes without reading them.

### JSON wire, `frozik-mux-json.v1`

The same messages, streams and flow control, encoded so a person can read
them in DevTools. A browser asks for it with the subprotocol (the transport's
`wireFormat: 'json'`); Node's public listener accepts either name and prefers
`frozik-mux.v1` when both are offered; the gateway's listener refuses it.

- OPEN, FIN, RESET and CREDIT are **text** messages:
  `{"type":"open","stream":1}`, `{"type":"fin","stream":1}`,
  `{"type":"reset","stream":1}`, `{"type":"credit","stream":1,"bytes":131072}`.
- DATA is a **text** message when its bytes are whole frames of the payload
  protocol whose contents are all JSON:
  `{"type":"data","stream":1,"frames":[…]}`, each frame one of
  `{"head":…}`, `{"end":…}`, `{"body":…}` (a DATA frame holding JSON text) or
  `{"messages":[{"message":…},{"flags":2,"message":…}]}` (a DATA frame holding
  Connect envelopes of JSON; `flags` is left out when it is 0).
- Any other DATA — protobuf, raw bytes, a chunk the credit window cut
  mid-frame — is a **binary** message `[u32 stream id][bytes]`.
- The receiver turns the frames back into bytes (`JSON.stringify`, the frame
  and envelope headers); credit, the DATA limit and every rule above apply to
  those bytes. A sender uses the text form only when it turns back into exactly
  the bytes it holds, and only up to 131 072 bytes of UTF-8 (twice the DATA
  limit); beyond that the chunk goes binary.
- Malformed JSON, an unknown `type`, a frame that is not exactly one of the
  four shapes, or frames that add up to more than 65 536 bytes are violations.

## Trace ids — W3C Trace Context

Every call carries a [W3C Trace Context](https://www.w3.org/TR/trace-context/) `traceparent` header —
the standard OpenTelemetry and every tracing backend speak — so a failure the
user reports finds its way to the server's log by one id, and a real tracer
plugs in without a change on the wire.

- **Client.** `traceInterceptor` (in every session transport) keeps a
  `traceparent` the caller set — an OpenTelemetry span, say — or starts a
  trace, and stamps the trace id on whatever error the call ends with, at
  once or mid-stream: `traceIdOf(error)` reads it back for the UI.
- **Server.** The tunnel reads the header (a call without a valid one gets a
  new trace, written back into the headers), puts it in `context.values` as
  `TRANSPORT_TRACE` for handlers and interceptors, and hands it to `onError`
  with transport-level failures (idle reset, broken frames).
- **Logging.** `createCallRecorder(onCall)` is a server interceptor that
  reports each call once, when it ends — trace id, procedure, protocol,
  duration, the first request messages summarized as JSON, message counts and
  the outcome — for the application to log however it logs.

The HTTP/3 gateway does not see calls (it forwards bytes), so the id lives in
the browser and in Node.

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
