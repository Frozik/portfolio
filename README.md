<p align="center">
  <a href="https://github.com/Frozik/portfolio/actions/workflows/ci.yml">
    <img src="https://github.com/Frozik/portfolio/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI">
  </a>
</p>

# [Portfolio](https://frozik.github.io/portfolio)

Interactive demos that go deeper than a to-do app: a house planner with
norm-checked electrics, a Battle City remake traced from the ROM, a live
Binance depth heatmap, artillery over GPU-simulated terrain, a genetic
algorithm learning to balance a pendulum, peer-to-peer video and
retrospective boards — all in the browser, all written from scratch in
strict TypeScript.

**Stack:** React 19 · TypeScript 7 · MobX 7 · Tailwind CSS v4 · Radix UI ·
Vite 8 · WebGPU · WebRTC · Yjs · Socket.IO · MediaPipe · WebMCP.

## Demos

Every demo has its own README with the details; the landing page is the
[CV](./apps/portfolio/src/features/welcome/README.md).

| Demo | What it shows | Live |
|---|---|---|
| [Pendulum](./apps/portfolio/src/features/pendulum/README.md) | A genetic algorithm evolves small neural networks to swing up and balance an inverted pendulum on a cart; own inference, closed-form physics, no engine. | [open](https://frozik.github.io/portfolio/pendulum)
| [Sudoku](./apps/portfolio/src/features/sudoku/README.md) | Sudoku with four difficulties, pen and notes modes, undo and validation. | [open](https://frozik.github.io/portfolio/sudoku)
| [Sun](./apps/portfolio/src/features/sun/README.md) | A WebGPU benchmark: a sun of as many triangles as the device draws at its display's frame rate, with a report of the graphics card. | [open](https://frozik.github.io/portfolio/sun)
| [Graphics](./apps/portfolio/src/features/graphics/README.md) | GPU-side 2D primitives — variable-width lines, gradients, animated shapes — at near-zero CPU cost. | [open](https://frozik.github.io/portfolio/graphics)
| [Timeseries](./apps/portfolio/src/features/timeseries/README.md) | Showcase of `@frozik/charts`: WebGPU charts on one shared device — live series, candles, snapshots — built as a headless kernel plus extensions. | [open](https://frozik.github.io/portfolio/timeseries)
| [Binance Orderbook](./apps/portfolio/src/features/binance-view/README.md) | A Bookmap-style live depth-of-market heatmap over a real Binance WebSocket feed, with trades and an hour of history. | [open](https://frozik.github.io/portfolio/binance)
| [Space Golf](./apps/portfolio/src/features/space-golf/README.md) | A gravity-flipping golf puzzle after Gravity Golfing, with its own physics and procedural Khokhloma-painted levels. | [open](https://frozik.github.io/portfolio/space-golf)
| [Stereometry](./apps/portfolio/src/features/stereometry/README.md) | A 3D construction workbench for stereometry puzzles with per-fragment occlusion of construction lines. | [open](https://frozik.github.io/portfolio/stereometry)
| [Tanks](./apps/portfolio/src/features/tanks/README.md) | A Battle City (NES, 1985) remake with mechanics traced from the ROM, all 35 stages, synthesized audio and no extracted assets. | [open](https://frozik.github.io/portfolio/tanks)
| [Ashfall](./apps/portfolio/src/features/scorched/README.md) | Scorched Earth reimagined: hot-seat artillery for 2–10 players over terrain simulated in WebGPU compute shaders. | [open](https://frozik.github.io/portfolio/scorched)
| [Site Planner](./apps/portfolio/src/features/site-planner/README.md) | A plot-and-house planner: survey the ground, draw the plot, build a multi-storey house with walls, stairs, roofs, furniture and norm-checked electrics and utilities, and see it in 3D. | [open](https://frozik.github.io/portfolio/site-planner)
| [OSM Map](./apps/portfolio/src/features/osm-map/README.md) | Own WebGPU slippy-map engine over OSM tiles: a tilted camera with fog, quadtree LOD that mixes tile zooms in one frame, tiles fading in over a checkerboard as they load, OSM buildings rising as boxes, woods and parks planted with trees, cars driving the streets and water rippling at street zoom. | [open](https://frozik.github.io/portfolio/osm-map)
| [Controls](./apps/portfolio/src/features/controls/README.md) | Financial input controls from the shared component library: precise numeric editors and a natural-language date picker. | [open](https://frozik.github.io/portfolio/controls) |
| [Table](./apps/portfolio/src/features/table/README.md) | Showcase and brand book of `@frozik/table`, a data grid built as a headless MobX kernel plus extensions, the visible grid included. | [open](https://frozik.github.io/portfolio/table)
| [Bug Reporter](./apps/portfolio/src/features/bug-reporter/README.md) | A mock treasury desk wired to `@frozik/bug-reporter`: one bug button captures a screenshot with marks or a tab recording, hides the sensitive numbers, bundles logs, errors, actions and device details into a zip streamed straight to disk. | [open](https://frozik.github.io/portfolio/bug-reporter)
| [HTTP/3 Transport](./apps/portfolio/src/features/transport/README.md) | Connect RPC over HTTP/3 WebTransport with a WebSocket fallback it picks by itself: plots a function the server parses and samples, and echoes a file through the server straight back to disk with backpressure end to end; every call carries a W3C Trace Context id. | [open](https://frozik.github.io/portfolio/transport)
| [Retro](./apps/portfolio/src/features/retro/README.md) | A peer-to-peer retrospective board: CRDT state synced browser to browser over WebRTC, no database. | [open](https://frozik.github.io/portfolio/retro)
| [Conf](./apps/portfolio/src/features/conf/README.md) | A two-person video call with AR glasses and an emotion emoji composited into the outgoing stream by MediaPipe. | [open](https://frozik.github.io/portfolio/conf)

## Getting started

```bash
pnpm install    # pnpm 11, Node 24
pnpm dev        # Vite dev server
pnpm check-all  # lint, format, types, layer boundaries, dead code, conventions, tests
```

## How it is built

- **A pnpm + Moon monorepo**: the browser app in
  [`apps/portfolio`](./apps/portfolio/README.md), the signaling and TURN
  backend in [`apps/communication`](./apps/communication/README.md), shared
  code in `libs/` (utilities and astronomy, the component library, the
  data-grid library, the wire protocol, repository tooling).
- **Every feature is an independent slice** with a framework-free domain at
  its centre and React, MobX and WebGPU plugged in at the edges; the layer
  direction is enforced by dependency-cruiser in CI.
- **One quality gate** — `pnpm check-all` — runs oxlint, oxfmt, TypeScript,
  dependency-cruiser, knip, repository conventions and Vitest; git hooks run
  the affected subset, CI runs `moon ci` and releases with semantic-release
  from Conventional Commits.
- **Agent-ready through [WebMCP](https://developer.chrome.com/docs/ai/webmcp)**:
  pages expose typed tools to browser AI agents — open any demo, play sudoku
  with hints and checks — instead of leaving them to guess at the DOM; a
  WebMCP badge in the top bar marks the demos that offer their own tools and
  links to [the page that lists them](https://frozik.github.io/portfolio/webmcp).
  Details in the [app README](./apps/portfolio/README.md#agent-tools-webmcp).
- **The landing scores 95+ on mobile Lighthouse**: prerendered at build time,
  a one-level-deep critical path, and a service worker that precaches the
  shell. The playbook is in the
  [app README](./apps/portfolio/README.md#performance--pwa).
