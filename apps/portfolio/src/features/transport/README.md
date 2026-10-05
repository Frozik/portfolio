# HTTP/3 Transport

One transport for every call: Connect RPC over HTTP/3 WebTransport, with a multiplexed WebSocket taking over by itself when UDP is blocked. Plots a function the server samples, and echoes a file through the server straight back to disk with backpressure end to end.

Live: [https://frozik.github.io/portfolio/transport](https://frozik.github.io/portfolio/transport) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/transport/`; the transport lives in [`libs/transport`](../../../../../libs/transport/README.md), the contract in [`libs/proto`](../../../../../libs/proto/README.md), the services in [`apps/communication`](../../../../communication/README.md).

The page is the transport's living documentation.

## Using it in your app

Everything network-related is three steps, and the page does nothing more:

```ts
import { createClient } from '@connectrpc/connect';
import { createTransport } from '@frozik/transport/client/create-transport';
import { FileService } from '@frozik/proto/frozik/transport/v1/file_pb';
import { PlotService } from '@frozik/proto/frozik/transport/v1/plot_pb';

// 1. One transport per server: HTTP/3 first, the WebSocket fallback by itself.
const transport = createTransport({ serverUrl: 'https://api.example' });

// 2. Generated clients over it — JSON or binary protobuf, chosen per method.
const plots = createClient(PlotService, transport);
const files = createClient(FileService, transport);

// 3. Ordinary Connect calls; a stream is an async iterable both ways.
for await (const chunk of plots.sample({ expression: 'sin(x)', xMin: 0, xMax: 6, points: 600 })) {
  draw(chunk.x, chunk.y);
}
for await (const response of files.echo(fileAsRequests(file))) {
  await writer.write(response.part.value); // the next response waits for the disk
}
```

The complete versions are one file each:
[`infrastructure/file-echo.ts`](infrastructure/file-echo.ts) — a file
through the server and back to disk with backpressure, checksums and
errors — and [`infrastructure/connect-plot-client.ts`](infrastructure/connect-plot-client.ts).

## How the page is built

Layered like every other feature; the network lives only in
`infrastructure/`, the rest never sees Connect:

- `domain/` — `connection.ts`, `plot.ts` (view, limits, density, expression
  errors), `echo.ts` (summary, verdict, speed), `call-failure.ts`, and one
  port per file in `ports/` (transport link, plot client, file echo, file
  sink, clock).
- `infrastructure/` — `file-echo.ts` and `connect-plot-client.ts`, the two
  services over Connect, plus the error mapping and the file sink opener.
- `application/` — `TransportStore` owns `ConnectionModel`, `PlotModel` and
  `EchoModel`: what each panel shows. `EchoModel` opens the save dialog and
  hands the file to the file echo; `plot-source.ts` turns the chart's window
  requests into plot calls.
- `presentation/` — `Transport.tsx` (the composition root: builds the
  transport and the clients, hands them to the store) and `TransportIntro`,
  then `connection/`, `plot/`, `echo/` with one panel each and its parts, and
  `common/` (panel frame, failure notice, byte formatting).

**One transport.** `createTransport` from `@frozik/transport` is the only
network object the page builds. It is a Connect `Transport`, so both
services' generated clients run over it, and it reports which protocol
carries it. It tries HTTP/3 first and falls back to a WebSocket on its own
when HTTP/3 does not open a stream within four seconds or the browser has no
WebTransport; it remembers the failure for five minutes so reconnects do not
wait again. HTTP/3 is served by a Go gateway in front of the Node server
([`apps/transport-gateway`](../../../../transport-gateway/README.md),
quic-go/webtransport-go), which bridges each WebTransport session onto the
same multiplexed WebSocket the fallback uses — so Safari, which needs the
newer WebTransport flow control, works over HTTP/3 too. The connection panel shows the state and lets the visitor force
either path to compare them. Each call is its own stream: a slow echo never
holds back a plot.

**The codec follows the schema.** Methods whose messages carry `bytes` travel
as binary protobuf; everything else as JSON, readable in the server logs. So
`GetPlotLimits`, `Sample` and `GetEchoLimits` are JSON, `Echo` is binary —
nothing is configured, the transport reads it from the method descriptor.

**Plot a function.** The visitor types a function of `x`
(`x^2 + 2x + 3`, `2sin(x)`, `1/x`) and the range the chart opens on; the page
checks what it can tell on its own (an empty expression, a backwards range)
and puts a live chart on screen. The chart is a `@frozik/charts` snapshot
series over a source that calls the server: on first show, after a pan past
the window it holds and after a zoom that changes the density, it asks for the
visible window (with a margin) again. The number of points is not a setting —
it follows the chart's physical width, one point per ten physical pixels
(`pointsFor`, CSS width × `devicePixelRatio` / 10), so zooming in brings finer
detail instead of stretching the old samples. The server parses the expression
with its own Pratt parser — no `eval`, a whitelist of functions behind a
`Map` — samples it and streams the points back in chunks. A parse error comes
back as `InvalidArgument` carrying a typed `ExpressionError`; the chart gives
way to the expression with a caret under the character the server stopped at.
Values the function does not have and the jump across an asymptote arrive as
`NaN`, and the line leaves a gap there. The vertical axis scales to what is
visible.

**File echo.** The visitor picks a file and presses *Start the echo*; the save
dialog opens on that click (it needs the gesture, and picking a file in the
system dialog does not count as one everywhere). The file is read in 64 KiB
chunks, each sent only when the transport asks for the next one; the server
passes every chunk straight back; each returned chunk is written to the
chosen file before the next response is read. A slow disk therefore slows the
reading of the source file — nothing piles up in the page, in the transport
or on the server. Both sides keep a CRC-32: the verdict is *intact* only when
the size and the checksum of what left, what the server saw and what came
back all agree. The summary also says the most bytes the server's handler
held at once. Finished echoes stay in a list, newest first, each with the
protocol it ran on and its speed, so the same file can be sent over HTTP/3 and
then over the forced WebSocket and the two compared. Where the browser can only save by holding the whole file in
memory (no File System Access, no service worker for StreamSaver) the echo is
refused rather than buffered.

**Limits.** The server sets them and the page reads them: files up to 1 GB,
4 GB an hour and two echoes at a time per address, sixteen in all, 25 MB/s per
echo. A stream where no bytes move either way for thirty seconds is reset, so
a client that stops reading the echo frees its slot as surely as one that
stops sending. Over the WebSocket fallback the server sees HAProxy's address,
not the client's, so there the per-address quotas give way to the server-wide
cap (HAProxy limits connections per source). The plot takes expressions up to
200 characters and at most 20 000 points per window; letters run together split into the
names it knows (`2pix` is `2·pi·x`).

**Development.** With `VITE_COMMUNICATION_URL=http://localhost:4445` the
page talks to a local server: the WebSocket fallback on the same port, and
HTTP/3 through the gateway container that `pnpm dev` in `apps/communication`
starts (Docker; without it only the fallback works). The certificate is a
self-signed one Node writes to `.dev-certs` and the gateway serves; the page
pins it by the hash at `/transport/pinned-certificate` (browsers accept a
pinned certificate for at most fourteen days, so Node renews it when less than
a day is left; Safari supports pinning from 26.4). Without that variable the
page talks to production.
