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
- Animated shapes (circles, polygons, stars) with fade-in/fade-out lifecycle
- Multi-pass rendering pipeline with 4x MSAA anti-aliasing

### Timeseries

Interactive time-series charts rendered through a **single shared WebGPU
context** — a technique for bypassing the browser limit of ~6-8 concurrent
WebGPU canvas contexts. Scales to unlimited charts with one `GPUDevice`.

**Shared Renderer pattern (Approach D):**
- One `GPUDevice` + one `OffscreenCanvas` shared across all chart instances
- Each chart renders sequentially into a pooled `GPUTexture`, then
  `copyTextureToTexture` copies it to the canvas texture **in the same
  command encoder** — GPU guarantees execution order within a single submit
- `transferToImageBitmap()` + `drawImage()` blits the result to the visible
  2D canvas
- This eliminates the iOS Safari race condition where `transferToImageBitmap()`
  could capture stale pixels (WebKit does a CPU readback that isn't
  synchronized with Metal command buffer completion)
- `RenderTargetPool` reuses GPU textures between charts — typically 1
  allocation for all charts in a 2x2 grid
- Renderer lifecycle managed by a React context provider owned by the page
- Per-chart isolation: independent viewport, block registry, and input handling

**Block-based data pipeline:**
- Data loaded in fixed-size 256-point blocks, cached in RTree, stored in
  `rgba32float` GPU texture (timeDelta, valueDelta, size, packedColor per texel)
- Period-aligned block boundaries (1h, 12h, 1d, 4d, 16d, 64d, 256d scales)
- Slot allocator with LRU eviction: texture grows from 4 to 512 rows, then
  recycles oldest blocks
- Multi-block rendering via GPU storage buffer — shader reads
  `BlockDescriptor[]` array to locate points across blocks
- Cross-block line stitching handled automatically by `readGlobalPoint()` in
  the shader
- Per-block delta encoding preserves float32 precision across all zoom levels
- Color packed as uint32-in-float32 with alpha in low byte to prevent
  exponent overflow and NaN canonicalization
- Architecture emulates server-side data loading (blocks can be replaced with
  `fetch()` calls)

**Noise-based data generation:**
- Simplex noise + fractal Brownian motion (fBm) with 6 octaves
- Deterministic and multi-scale: zoom in reveals detail, macro shape stays
  stable
- Each chart uses a unique seed for independent data
- Bullish/bearish coloring (green/red) based on price direction

**Multiple chart types with per-series configuration:**
- 4-chart grid: line + candlestick, candlestick only, line only, rhombus
  markers
- Each series configured independently via `ISeriesConfig` (chart type, seed,
  custom color/size functions)
- Value-based styling: rhombus markers colored by threshold bands
  (blue/green/orange/red), line thickness varying by value
- Separate GPU render pipelines per chart type (line, candlestick, rhombus)
- Simulated async data loading with animated shimmer loading bar

**Chart features:**
- Animated zoom with lerp-based easing and viewport spring on resize
- Pan and pinch-to-zoom touch support
- Line, candlestick, and rhombus series (candlestick shape rendered entirely
  in fragment shader)
- Adaptive axis labels that scale from hours to months
- Unified canvas rendering: 2D canvas (background + grid + axis labels with
  backdrop + WebGPU blit + loading bars)
- Debug overlay: real-time render FPS counter + block boundary visualization
  toggle
- Fullscreen + landscape lock on mobile devices

**Performance optimizations:**
- Event-driven FPS controller with debounced degradation
  (interaction=60fps → idle=5fps)
- Axis label memoization: only re-renders when viewport or canvas size changes
- 4x MSAA anti-aliasing with shared texture (resized per chart, not
  reallocated)
- Relative snap threshold for zoom animation: prevents sub-pixel updates
- Scissor rect clips GPU rendering to the plot area
- Render target pool: one GPU texture allocation reused across all same-size
  charts per frame

### Stereometry

Interactive 3D construction tool for stereometry puzzles, rendered with WebGPU.
Build construction lines, find intersection points, and explore cross-sections
of 3D solids — a digital geometry workbench.

**Rendering architecture:**
- Unified per-instance styling: each line segment and vertex marker carries its
  own visible and hidden styles directly in the GPU instance buffer — no
  per-modifier pipeline proliferation
- Layered visibility rendering: depth pre-pass (faces) → hidden lines → hidden
  markers → visible lines → visible markers, using pipeline-overridable
  `renderMode` constants to filter fragments by occlusion state. Two MSAA render
  passes with independent depth buffers ensure visible elements always render on
  top of hidden ones regardless of 3D depth
- Orthographic projection with 4x MSAA anti-aliasing
- GPU-based vertex occlusion via depth texture sampling in the vertex shader —
  the marker center is tested against the depth buffer, producing a binary
  visible/hidden decision for the entire marker (no split-half artifacts)
- Markers render on top of lines within each visibility layer via
  `depthCompare: 'always'` — no depth offset hacks
- Depth-based alpha fade: elements further from the camera smoothly fade to
  transparency, controlled by `depthFadeRate` and `depthFadeMin` uniforms
- All sizes (line width, marker diameter, dash/gap) specified in CSS pixels,
  automatically scaled by `devicePixelRatio` in the shader

**CSS-like style cascade:**
- Styles defined as `'element:modifier1:modifier2'` keys with partial overrides
  (e.g., `'line:hidden:selected'`), resolved by specificity like CSS
- Modifiers are arbitrary strings — adding a new visual state (e.g., `marked`)
  requires only a style entry, no code changes
- Modifier order in keys is auto-normalized (alphabetically sorted)
- Style properties: `color` (hex), `alpha`, `width`, `size`, `line`
  (solid/dashed with dash/gap), `markerType` (solid/circle), `strokeColor`,
  `strokeWidth`
- Vertex markers support two render types: `solid` (filled circle) and `circle`
  (stroke + fill with configurable stroke color and width)

**Segment & marker processor:**
- Pure function that splits infinite lines into classified segments based on
  geometry: `segment` (coincides with a topology edge), `inner` (inside the
  figure or on a face), or regular (no modifier)
- Vertex markers receive `inner` modifier when on the figure surface (topology
  vertices or intersection points on faces), using a two-step test:
  point-on-triangle surface check (barycentric with epsilon tolerance) followed
  by ray casting for interior points
- Face intersection via ray-triangle (Moller-Trumbore) and coplanar face
  clipping for lines lying on figure faces
- Topology edges, extended lines, and user-drawn lines are all unified as
  `SceneLine` — no separate entity types

**Puzzle format:**
- Declarative puzzle definitions: figures (vertices + faces), input constraints
  (additional points and lines), and expected results
- `preparePuzzle()` derives edges from faces and builds topology automatically

**Interactions:**
- Drag to rotate, Shift+drag to pan, scroll/pinch to zoom with inertia
- Unified Pointer Events for mouse, touch, and pen (fixes mobile double-event
  bug where touch + synthesized mouse caused false double-clicks)
- Click an edge or line to select it (highlighted with cascade style)
- Double-click an edge to extend it into an infinite construction line
- Double-click a line to remove it
- Drag from vertex to vertex to draw a construction line between two points
  (preview line shown during drag, snap target vertex highlighted)
- Select an edge/line, then tap a vertex to create a parallel line through it
- Duplicate line prevention: adding a line that already exists is a no-op
- Intersection points appear automatically where lines cross and become
  available as construction vertices
- Undo/redo for all construction actions

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
