<p align="center">
  <a href="https://github.com/Frozik/portfolio/actions/workflows/ci.yml">
    <img src="https://github.com/Frozik/portfolio/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI">
  </a>
</p>

# [Portfolio](https://frozik.github.io/portfolio)
Portfolio monorepo — interactive demos showcasing React, WebGPU,
TensorFlow.js, and physics simulations.

**Tech stack**: React 19, TypeScript 6, MobX, Tailwind CSS v4, Radix UI, Vite 8,
WebGPU, TensorFlow.js, Matter.js, Dockview.

## Getting Started

```bash
pnpm install    # Install dependencies
pnpm dev        # Start dev server
pnpm check-all  # Run full validation (lint + types + tests + format)
```

## Features

### CV

Resume page with work experience, skills, education, and contacts.
Available in PDF format for download.

### Pendulum

Genetic algorithm evolves neural networks to balance an inverted pendulum.
Uses TensorFlow.js for neural network inference and Matter.js for 2D physics
simulation.

**Fitness Playground** — simulation area for neural networks. The best
candidates are selected using mutation and crossover. Simulation speed adapts
automatically to CPU performance without freezing the UI.

**Generations** — load saved generations or create new ones. Displays a table
with generation numbers and all robots from that generation. Select any robot
to test it.

**Test Playground** — test individual robots by applying external forces.
Click on the area to introduce instability — closer to the weight means
stronger force, longer press means greater effect. Deselect the robot to try
manual control (arrow keys for movement, Shift for boost).

**Neural Network** — visualizes the network structure: weights, biases, layers,
and neuron counts. Hover over a neuron to inspect its weights and biases.

### Sudoku

Sudoku game with pen/notes tool modes, undo history, and field validation.

### Sun

WebGPU particle visualization — 100,000 billboard instances on a sphere with
time-based animation, neon gradient coloring, and 4x MSAA anti-aliasing.
Interactive orbit camera via mouse drag and touch with rotation inertia.

### Graphics

GPU-accelerated 2D rendering of graphic primitives with WebGPU — near-zero
CPU usage and minimal GPU overhead. Features:
- Variable line thickness with rounded joins between segments
- Gradient coloring per segment
- Transparent sin-Y wave layer composited over the main scene
- Animated shapes (circles, polygons, stars) with fade-in / fade-out lifecycle
- 4× MSAA anti-aliasing across the whole scene

### Timeseries

A 2×2 grid of interactive time-series charts, each with its own
visualization style, all rendered through WebGPU on a single shared
canvas context.

**What you see:**
- Four independent charts: line + candlestick overlay, candlesticks only,
  line only, and rhombus markers sized by value
- Rhombus markers use colored threshold bands (blue / green / orange /
  red) so extreme values are instantly spottable
- Line thickness varies with the data — calm stretches render thin,
  volatile patches render thick
- Each chart has its own synthetic dataset, generated from multi-octave
  simplex noise so zooming in reveals finer detail while the macro shape
  stays stable
- A shimmer loading bar slides across the chart while blocks of data
  stream in, simulating real server-side loading

**Interactions:**
- Drag to pan, scroll or pinch to zoom, spring-animated transitions on
  zoom and resize
- Time axis labels scale automatically from hours all the way out to
  months as you zoom out
- Debug overlay with FPS counter and a toggle to visualize the data
  block boundaries
- Fullscreen with landscape lock on mobile

**Behind the scenes:**
- One WebGPU device drives all four charts, sidestepping the browser
  limit of roughly 6–8 concurrent WebGPU canvas contexts
- 4× MSAA on every chart, with a shared anti-aliasing texture that
  resizes in place rather than being reallocated per chart
- FPS gates down to 5 fps when nothing is moving and ramps back to 60
  the instant you interact
- Data arrives in fixed 256-point blocks that the GPU stitches into a
  continuous line — the architecture maps 1:1 onto a real server-backed
  data source if we ever swap the noise generator out

### Binance Orderbook

Live heatmap of the Binance BTC/USDT orderbook with a price line on top
and volume bars down the side — essentially a Bookmap-style
depth-of-market display built on WebGPU.

**What you see:**
- Heatmap where every cell is one price level at one second, colored
  green → yellow → red by `price × volume` — heavy liquidity walls
  pop, thin noise fades into the dark background
- A mid-price line drawn on top, each segment colored by direction
  (green up, red down, grey flat) with a black outline that stays
  clean through sharp turns
- Right-hand panel with a volume bar for every visible price level —
  green for bids, red for asks, width proportional to the heaviest
  level currently on screen
- Crosshair with time and price labels pinned to the axes
- Status badge in the corner; click to expand connection state,
  snapshot counter, last tick time, and any errors

**Interactions:**
- Drag or swipe to pan into the past, scroll or pinch on the price
  axis to zoom in
- Hover any cell for a tooltip with timestamp, price, volume, and
  side (bid / ask)
- Auto-follow sticks to the latest data until you pan backward; scroll
  all the way forward to the live edge and the chart re-latches
- Cells that arrive during a disconnect render with diagonal stripes
  so stale data is immediately distinguishable from live data

**Data:**
- Real Binance WebSocket feed (`BTCUSDT@depth@1000ms`) with the REST
  snapshot merged in; sequence gaps and clean-close drops auto-resync
  with interpolated backfill covering the downtime
- 700 raw price levels per side aggregate into 64 `$1.50` bins for
  display
- Rolling one-hour history in IndexedDB (~7 MB on disk), lazy-loaded
  when you pan into the past; cleared on page reload
- Mid-price is computed locally from `(bestBid + bestAsk) / 2` — one
  WebSocket powers the heatmap, the line, and the volume bars

**Robustness:**
- Follow mode survives background-tab throttling: when the browser
  freezes the render loop, the chart catches up to the live edge the
  moment the tab wakes up instead of getting stuck minutes in the
  past
- Offline detection hooks into `navigator.onLine` so reconnect waits
  for the network instead of burning CPU on a dead socket
- Cross-browser: shader compilation errors are surfaced through a
  single console prefix so Chrome / Safari / Firefox quirks are
  immediate to spot during development

### Stereometry

Interactive 3D construction tool for stereometry puzzles — a digital
geometry workbench rendered with WebGPU. Pick a figure, draw
construction lines, find intersection points, and explore cross-sections
of solids.

**Construction:**
- Drag from one vertex to another to draw a construction line; the
  target vertex highlights when your line snaps to it
- Double-click any edge to extend it into an infinite construction
  line that cuts across the figure
- Select a line, then tap a vertex to drop a parallel line through
  that point
- Double-click a line to delete it; duplicate lines are ignored
  automatically
- Intersection points appear wherever two lines cross and become
  first-class snap targets for new lines
- Full undo / redo history

**Visuals:**
- Parts of a line occluded by the solid render dashed; visible
  stretches stay solid — decided per-fragment, so the effect stays
  correct from every camera angle
- Vertex markers render as filled or stroked circles and are
  occlusion-tested against both the figure's faces and any lines
  passing through them
- Elements farther from the camera fade smoothly toward transparency,
  giving a sense of depth without needing a grid
- Selection, hover, and "inside the figure" states flow through a
  CSS-like style cascade — adding a new state (e.g. `marked`) is a
  one-line change
- Orthographic or perspective projection with 4× MSAA anti-aliasing

**Interactions:**
- Drag to rotate the camera, Shift+drag to pan, scroll or pinch to
  zoom — with inertia on all three
- Unified pointer handling works identically on mouse, touch, and
  stylus; no duplicate events on mobile

**Puzzle format:**
- Declarative puzzle files: list of figures (vertices + faces), input
  constraints (points, lines), expected result
- Edges and face adjacency derive automatically from the face list —
  puzzle authors only describe what's unique to the puzzle

### Controls

Interactive showcase of financial input controls from the `@frozik/components`
shared library.

**Numeric Editor (Rate / Amount / Number):**
- Configurable decimal precision (0–10 digits) via slider
- PIP highlighting — adjustable start position and size to emphasize significant digits
- Suffix support: type `K`, `M`, `B` for thousands, millions, billions
- Negative values supported

**Date/Time Picker:**
- Free-form text input with fuzzy parsing — understands natural language:
  keywords (`today`, `tomorrow`, `now`), weekdays (`mon`–`sun`, `next fri`,
  `last monday`), offsets (`+3d`, `-1w`, `in 3 days`, `2 weeks ago`),
  boundaries (`eom`, `bom`, `eoy`, `Q1 2025`), ordinals (`15th`, `the 1st`),
  dates (`2025-01-15`, `15/03/2025`, `10nov`, `jan 15 25`),
  time (`13:00`, `9am`, `5:30pm`, `9:30:45.123`), and combined (`tom 13:00`,
  `mon14`, `yesterday10`)
- Calendar popup with monospace font, enlarged navigation buttons, and
  bold weekday headers
- Time picker with hour/minute/second/millisecond controls — hold-to-repeat
  (5 steps/second on long press)
- Configurable arrow key step (minute, hour, day, week) and time resolution
  (minutes, seconds, milliseconds)
- Parse direction toggle: future-only vs nearest match
- Weekend highlighting in calendar grid

### Retro

Local-first collaborative retrospective board for Agile teams. Zero backend —
data lives in each participant's IndexedDB, syncs peer-to-peer via WebRTC
(Yjs CRDT). For the WebRTC signaling handshake this demo runs its own
`y-webrtc` server (`apps/retro-signaling`, a TypeScript + `ws` service
deployed as a systemd unit behind nginx + Let's Encrypt on a bare Ubuntu
VPS). The URL is injected at build time via `VITE_RETRO_SIGNALING_URLS`,
with a fallback to the public `signaling.yjs.dev` / `y-webrtc-eu.fly.dev`
servers when the env var is not set. The signaling channel is used only
for the initial SDP exchange — once peers connect, data flows directly
over WebRTC DataChannels.

**Lobby** (`/retro`) — list of locally stored retros (name + creation date +
participant count) plus Create and Join-by-link actions.

**Room** (`/retro/:uuid`) — a columns board driven by the selected template:
Scrum (Went Well / To Improve / Action Items), Mad / Sad / Glad, or
Start / Stop / Continue. Cards added during Brainstorm render face-down
(hidden until reveal) with a 3D flip animation that stagger-flips on phase
advance to Group. Only the retro organizer (facilitator) can advance phases
and control the shared timer.

Data model is fully captured in the shared Yjs document (`meta`, `columns`,
`cards`, `groups`, `votes`, `actionItems`); ephemeral presence (names,
colors, typing indicators) is carried through Yjs awareness and never
persisted.

**Stack:** `yjs`, `y-indexeddb`, `y-webrtc` for CRDT storage + P2P sync;
`@dnd-kit/*` for accessible drag-and-drop; MobX facade (`RoomStore`,
`RetroLobbyStore`, `IdentityStore`) wraps Yjs so presentation stays
library-agnostic. See `RETRO.md` for the full feature design.

### Conf

Anonymous 2-person WebRTC video call with AR "glasses" and an emotion
emoji **baked into the outgoing video track itself** (not rendered as a
DOM overlay) — fully in-browser, no accounts. Reuses the same
`y-webrtc` signaling server as Retro (zero server changes; conf rooms
publish under a `frozik-conf-*` topic namespace) plus Google STUN for
ICE.

Each client runs a single MediaPipe `FaceLandmarker`
(`@mediapipe/tasks-vision`, GPU delegate with WASM fallback) on its own
camera feed, composites the video frame + glasses sprite + emotion
emoji onto an off-DOM `<canvas>`, then exports the canvas via
`canvas.captureStream(30)` as the outbound WebRTC video track
(original audio track is attached alongside). The remote peer receives
one already-composited track — no remote-side detection, no overlay
element, identical view on both sides. AR toggle is a flag inside the
compositor that skips the glasses / emoji draw; mute toggles
`track.enabled` on the output track without renegotiation.

Glasses position is computed from eye-corner landmarks (MediaPipe
indices 33/133/263/362) as a pure domain function, then smoothed with
an EMA before `ctx.drawImage(glassesSvg, …)`. Emotion is derived from
the 52 ARKit-style blendshape scores MediaPipe emits alongside
landmarks: `happy` / `surprised` / `sad` / `angry` / `neutral` via a
max-excess-over-threshold classifier; a 2-frame hysteresis prevents
emoji flicker. Adaptive quality polls `RTCPeerConnection.getStats()`
every 2.5 s and steps `sender.setParameters` between HD / SD / Low
tiers based on RTT + packet loss — no renegotiation.

**Lobby** (`/conf`) — locally remembered rooms you created or visited,
plus Create and Join-by-link actions.

**Room** (`/conf/:uuid`) — side-by-side (left/right on desktop, stacked
top/bottom on mobile) local + remote video tiles with mute audio / mute
video / AR toggle / share link / leave controls plus a quality badge
and RTT sparkline. The signaling protocol is a tiny typed discriminated
union (`hello` / `offer` / `answer` / `ice` / `bye`) over the y-webrtc
wire format; `hello` carries a per-session nonce so the receiver can
tell an echo from a reconnect. Each browser keeps a persistent
`participantId` in `localStorage`, so dropping the WiFi and coming back
reclaims the same slot — even while the peer is still showing
"Peer disconnected". Third-joiner is rejected with a `bye{full}`
message. Perfect negotiation handles offer collisions.

**Stack:** `@mediapipe/tasks-vision` (FaceLandmarker, GPU delegate with
WASM fallback, `outputFaceBlendshapes: true`) loaded lazily from CDN;
native `RTCPeerConnection` with perfect negotiation; `canvas.captureStream`
for output compositing; plain WebSocket client talking the y-webrtc
publish / subscribe protocol directly. See
`apps/portfolio/src/features/conf/CONF.md` for the full feature design.
