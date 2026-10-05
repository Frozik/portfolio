# Multiplexer protocol, `frozik-mux.v1`

Many byte streams over one WebSocket, each with its own flow control. The
browser speaks it when HTTP/3 is unreachable; the HTTP/3 gateway speaks it to
Node for every WebTransport session. Two implementations exist —
`src/mux/` (TypeScript) and `apps/transport-gateway/internal/mux` (Go) — and
both run the shared vectors in `src/mux/mux-vectors.json`. A change here is a
change to both and to the vectors.

## Connection

- A WebSocket with the subprotocol `frozik-mux.v1`. Admission happens at the
  HTTP upgrade (`403` when refused); there is no handshake after it, and the
  session is usable as soon as the socket is open.
- Every mux message is exactly one **binary** WebSocket message; the message
  boundary is the frame boundary, there is no length prefix. A text message is
  a protocol violation.
- Close codes: `1000` normal end; `4002` protocol violation (the reason names
  it). Closing the socket fails every open stream in both directions.

## Messages

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

## Streams

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

## Flow control

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

## Payload

The mux is byte-transparent. On top of it each stream carries one Connect call
in the frame protocol of `src/frame/` (`HEAD · DATA* · END`), which only the
endpoints parse; the gateway forwards bytes without reading them.
