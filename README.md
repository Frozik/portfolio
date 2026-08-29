<p align="center">
  <a href="https://github.com/Frozik/portfolio/actions/workflows/ci.yml">
    <img src="https://github.com/Frozik/portfolio/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI">
  </a>
</p>

# [Portfolio](https://frozik.github.io/portfolio)
Portfolio monorepo — interactive demos showcasing React, WebGPU,
TensorFlow.js, and physics simulations.

**Tech stack**: React 19, TypeScript 7, MobX 7, Tailwind CSS v4, Radix UI, Vite 8,
WebGPU, WebRTC, Yjs, Socket.IO, TensorFlow.js, MediaPipe, Matter.js.

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

Sudoku game with four difficulty levels, pen/notes tool modes, undo history,
and field validation.

### Sun

WebGPU particle visualization — 250,000 billboard instances on a sphere with
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
- FPS gates down to 10 fps when nothing is moving and ramps back to 60
  the instant you interact
- Data arrives in fixed 256-point blocks that the GPU stitches into a
  continuous line — the architecture maps 1:1 onto a real server-backed
  data source if we ever swap the noise generator out

### Binance Orderbook

Live heatmap of a Binance spot orderbook with a price line on top and
volume bars down the side — essentially a Bookmap-style depth-of-market
display built on WebGPU. BTC, ETH, SOL and DOGE are switchable from the
instrument selector, each with its own price-bin height.

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
- Real Binance WebSocket feed (`<symbol>@depth@1000ms`) with the REST
  snapshot merged in; sequence gaps and clean-close drops auto-resync
  with interpolated backfill covering the downtime
- 800 raw price levels per side aggregate into 64 bins for display
  (`$1.50` per bin on BTC, scaled to a comparable fraction of price on
  the other instruments)
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

**Trades layer:**
- Live trades from Binance `@aggTrade` are aggregated into per-second
  buckets and rendered as circles over the orderbook heatmap. Fill is
  a pie chart split by notional-weighted buy / sell share (12 o'clock
  clockwise, green / red); stroke is solid cyan
- Click a circle for a popup with the raw trades in that second; hover
  for a quick-stats pill
- Persistence: aggregates + raw trades in IndexedDB (cleared on
  `pagehide`), LRU-evicted at 32 / 8 blocks respectively

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

### Tanks

A faithful Battle City (NES, 1985) remake rendered with WebGPU — all 35
original stage layouts with gameplay rules traced from a disassembly of the
original ROM.

**Fidelity:**
- Exact original mechanics: 8-unit grid snap on turns, per-class tank
  speeds, quadrant-level brick destruction, the three power-up carriers per
  stage, weighted power-up odds, and the enemies' three-phase aggression
  curve (wander → hunt the player → converge on the base)
- Animation timings (track frames, spawn twinkle, explosions, shovel's
  flashing warning) match the original tick-for-tick
- Everything creative is original work: pixel art authored as code and
  rasterized into a single texture atlas at startup, sound effects and
  jingles synthesized with WebAudio — the repo contains no extracted assets
  and no binary files

**Engine:**
- Pure TypeScript domain (100% unit-tested, 400+ tests) driving a
  fixed-timestep 60 Hz simulation, decoupled from display refresh
- Instanced WebGPU rendering: terrain quadrants, sprites with palette
  variants, see-through forest canopy above the tanks, effects overlay
- Keyboard + touch controls (diagonal-split D-pad with slide-between-zones
  steering), auto-pause on tab switch, best score persistence

### Ashfall

A modern reimplementation of the classic DOS artillery duel Scorched Earth
(1991) — hot-seat battles for 2–10 players over destructible terrain, with
the terrain simulation running in WebGPU compute shaders.

**Gameplay:**
- The original arsenal (24 weapons: missiles, nukes, MIRVs, rollers,
  napalm, dirt bombs, lasers…) and accessory catalog (shields,
  batteries, guidance systems) with manual-sourced prices and
  behaviors
- Eight AI personalities from the original manual — from the random-firing
  Moron to the wind-compensating Cyborg with vindictive targeting
- Rounds economy: banked cash with interest, a redesigned armoury screen
  with family-grouped weapon cards, sell-back, and honest bundle-cap markup
- Damage caps firepower (health × 10) — the original's signature coupling

**Engine:**
- Terrain lives as a per-column heightfield in the pure domain; the GPU
  mirrors it into a texture, stamps craters in a compute pass, and animates
  the falling-sand collapse column-by-column — provably convergent to the
  domain's instantly-computed rest state
- Explosion debris, smoke, and napalm flames are GPU-simulated particles
- Drag-to-aim (mouse or touch) with a live wind-aware trajectory ghost;
  screen shake and hit-stop honoring `prefers-reduced-motion`
- All audio synthesized in code; the talking-tank taunts are our own
  writing in both languages

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

Collaborative retrospective board for Agile teams. Sign in with Google or
Yandex, create a board, share the link — participants sync in real time
directly between browsers, with no central database holding the data.

**Lobby** (`/retro`) — list of locally stored retros (name, creation date,
participant count) plus Create and Join-by-link actions. The default
nickname is seeded from your sign-in profile; sign-out is a click away.

**Room** (`/retro/:uuid`) — a columns board driven by the selected template:
the classic Scrum three-column format (Went Well / To Improve / Action
Items), in English or Russian. Cards added during Brainstorm render face-down
(hidden until reveal) with a 3D flip animation that stagger-flips on phase
advance to Group. Only the retro organizer (facilitator) can advance phases
and control the shared timer.

**Behind the scenes:**
- Each participant's IndexedDB is the source of truth — retros sync
  directly between browsers over WebRTC, and the underlying CRDT
  guarantees both sides converge to the same state regardless of message
  order or temporary disconnects
- A small backend service handles only the initial peer-to-peer
  handshake and hands out short-lived TURN credentials for NAT
  traversal; once two browsers connect, retro data flows directly
  between them and the server is no longer in the loop
- Sign-in is Google or Yandex (the user picks the provider on the
  sign-in screen); the session token lives only in `sessionStorage`,
  so closing the tab fully signs the user out

**Stack:** `yjs`, `y-indexeddb`, `y-webrtc` for CRDT storage and P2P
sync; `@dnd-kit/*` for accessible drag-and-drop; pluggable sign-in
abstraction (`IOidcProvider`) with Google and Yandex strategies;
MobX facade (`RoomStore`, `RetroLobbyStore`, `IdentityStore`) wraps
Yjs so presentation stays library-agnostic. The signaling backend
([`apps/communication`](./apps/communication/README.md)) is a Fastify 5
+ Socket.IO 4 server with a `coturn` TURN sidecar, deployed on a single
Ubuntu VPS.

### Conf

2-person video call with AR "glasses" and an emotion emoji baked
straight into the outgoing video stream — fully in-browser, no plugins.
Create a room, share the link; no sign-in required.

**Lobby** (`/conf`) — locally remembered rooms you created or visited,
plus Create and Join-by-link actions. Calls are anonymous: a room id is
all a participant needs, and the room list never leaves the browser.

**Room** (`/conf/:uuid`) — local + remote video tiles, side-by-side on
desktop and stacked on mobile, with mute audio / mute video / a
glasses-style picker (none / round / pink hippie stars / teacher
rectangles) / share link / leave controls, plus a quality badge and
an RTT sparkline. Each browser keeps a persistent participant id
locally, so a WiFi drop and return reclaims the same slot even while
the peer is still showing "Peer disconnected". A third joiner is
politely turned away with a "room full" message.

**Behind the scenes:**
- Each side runs Google's MediaPipe face detector on its own camera
  feed, draws the chosen glasses sprite and emotion emoji onto a
  hidden canvas, and sends that composited canvas as the outgoing
  video track — the remote peer receives an already-finished frame,
  with no remote-side detection and no overlay element. The same
  trick lets the user switch glasses style or mute / unmute without
  renegotiating the call.
- Emotion (`happy` / `surprised` / `sad` / `angry` / `neutral`) is
  picked from MediaPipe's facial-blendshape scores, with a short
  hysteresis so the emoji doesn't flicker on borderline expressions.
- Adaptive video quality watches round-trip time and packet loss every
  couple of seconds and steps the encoder between HD / SD / Low tiers
  without dropping the call.
- Same signaling backend as Retro, joined anonymously — the server hands
  out short-lived TURN credentials with a tighter relay window for
  unauthenticated sessions. Once the call is up, audio and video flow
  peer-to-peer over WebRTC.

**Stack:** `@mediapipe/tasks-vision` (FaceLandmarker, GPU delegate with
WASM fallback) loaded lazily from CDN; native `RTCPeerConnection` with
perfect negotiation; `canvas.captureStream` for output compositing;
`socket.io-client` against
[`apps/communication`](./apps/communication/README.md) for signaling.
