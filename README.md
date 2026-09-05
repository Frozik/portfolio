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
pnpm lighthouse # Production build + Lighthouse CI against the landing page
pnpm analyze    # Production build + bundle treemap (bundle-stats.html)
```

## Performance & PWA

The landing page is tuned for Lighthouse on a throttled mobile profile
(measure only against `vite build` + `vite preview` or the live site — the
dev server serves unminified pre-bundled dependencies and is not
representative):

- **Critical path is one level deep.** The landing (`welcome`) is imported
  statically, so its code ships in the entry; the React runtime and the
  shared vendor code are separate `modulepreload`ed chunks that stay cached
  across deploys. Everything else — every demo, the auth/signaling stack
  (Google Identity, MobX session), the QR / menu / contact dialogs, the PDF
  export — loads on navigation or on click.
- **Ambient canvases have a CPU budget.** `useAmbientCanvas` sizes canvases
  from `ResizeObserver` (no forced layout after React commits), caps the
  device-pixel ratio and frame rate per surface, pauses off-screen and
  hidden canvases, and allocates below-the-fold canvases only when they
  first scroll into view. The full-screen glow is painted at 1/8 resolution
  and upscaled.
- **Service worker precaches the app shell only** (`index.html`, its
  scripts and CSS, icons); hashed feature chunks are cached on first use
  with a cache-first strategy. A first-time install never reloads the page —
  only a real update of an already-controlled page does.
- **Budgets are enforced** by `pnpm lighthouse` (`apps/portfolio/lighthouserc.json`):
  Performance ≥ 95 on mobile, the other categories at 100, and transfer-size
  caps for scripts, CSS and third-party code.

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

### Site Planner

A planning tool for a real plot of land: draw the boundary and the building
footprint on a 2D plan, survey the ground with elevation marks, then look at
the result in 3D to see how the house sits on the slope. The plan is the
source of truth — every mesh, contour and overlay is a pure function of it.

**Plan (canvas2d):**
- Stock houses: a catalogue dialog offers complete ready buildings — walls,
  rooms, furniture, electrics, utility entries, a pitched roof — each
  previewed by the very renderer the plan uses, placed with every id minted
  anew, and editable like anything drawn by hand; a building saved from
  another plan loads from a JSON file the same way
- The plot outline and the building footprint are compositions of rectangles,
  circles and ellipses combined with union / subtract. The shapes stay
  parametric, so every size, position and rotation is also typed in exactly —
  metres and degrees from the keyboard, not dragged by eye. A drawn shape hands
  the pointer straight back to the select tool with itself selected and the
  keyboard in its size field, so the rough drag is replaced by the surveyed
  number without reaching for the mouse again — and the next click adjusts what
  was just drawn instead of starting another one
- Terms nest to any depth: any of them can be wrapped into a group, and a
  group folds on its own before joining the fold around it. That is what
  makes "cut a hole in this shape, then subtract the whole result from the
  plot" expressible — a flat list of operations cannot confine a subtraction
  to the part it was drawn against
- The structure tree is rearranged by dragging a term's grip: into a group,
  back out of one to any level, or to another place in the same fold, with
  the arrow buttons kept for the keyboard. A group is refused a drop into
  itself or into anything nested in it, and whichever term ends up first in a
  fold is unioned — a fold starts from nothing, so a leading subtraction
  would fold the whole list away
- Elevation marks go in like survey spots — click a point and type its
  height, or paste a whole block of `x, y, z` lines — and a thin-plate spline
  interpolates them into terrain, drawn back as labelled contour lines. It is
  the surface a thin metal sheet would take pinned at every mark: smooth
  everywhere rather than faceted, exact at the marks, and — through its affine
  term — exactly planar wherever the survey describes a plane, inside the
  marks and out beyond them alike, so the ground between two marks of equal
  height holds that height instead of sagging between them. Marks that all
  share a line leave no sheet to bend and run a profile along that line
  instead. The terrain is sampled over the plot's bounding box because
  interpolation needs the full grid, but only the plot is drawn from it: the
  lines are clipped to the boundary and each caption is placed on the stretch
  inside it
- A catalogue of things to place: trees by species — spruce, pine, thuja and
  broadleaf, each with a silhouette of its own in 3D — and cars, drawn to the
  4.5 × 1.8 m a real one takes and turned by a grip at the nose, so a drive can
  be checked for the room it leaves. Paths (polylines inflated into ribbons,
  reshaped point by point — drag a point, split a segment, remove a bend) and
  a setback line offset inward from the boundary complete the ground plan
- A scanned cadastral plan or a satellite screenshot can be laid under the
  canvas, calibrated by clicking two points and typing the distance between
  them, and traced over
- The plot is drawn the way it is convenient to draw it — square to the sheet
  — and north is placed afterwards, by dragging the needle of the compass
  card's dial (snapped to a degree, to 15° with Shift, free with Alt) or by
  typing the azimuth. One bearing feeds the plan's corner compass, the 3D
  gizmo and the sun alike, so the shadows turn with the needle
- Where on Earth the plot lies is picked off a map rather than typed — a
  Leaflet view of OpenStreetMap, toned to the dark theme, with a pin to click
  or drag. Applying it records the coordinates and, from an offline boundary
  table, the IANA time zone they fall in, so one gesture sets everything the
  sun study reads. The map is fetched only when it is asked for
- Compass, scale bar, snapping grid, a two-point measure tool, per-layer
  visibility, undo / redo, and autosave into IndexedDB
- Needs no WebGPU at all — only the 3D view sits behind the guard

**3D (WebGPU):**
- The terrain is one static grid mesh displaced in the vertex shader from the
  sampled heightfield, with normals from central differences — the surface
  can never drift out of step with the marks. Every sample carries how much of
  the plot covers it, and the fragment shader discards whatever falls outside
  the boundary: the plot stands as an island against the sky, edged by the
  accent line draped along its own outline
- The house is not deformed by the ground: the footprint takes a pad
  elevation (terrain centre / mean / minimum, or set by hand) and an apron
  down to the terrain, the way building pads work in CAD
- Sun and shadows for a date and a time of day at the plot's coordinates
  (St Petersburg by default), from `suncalc` — a single 2048² shadow map
  with PCF filtering, a slider running sunrise to sunset, and a play button
  that animates the day
- Render-on-demand: a frame is encoded only once the camera or the plan
  actually moved

**Buildings:**
- A building opens its own **editor** (double-click it): walls are drawn with
  a rubber band, a live «length · angle» readout beside the cursor and a
  typed length that fixes the segment exactly — the CAD value box — with
  Shift locking the angle and object snap catching the ends and midpoints of
  the walls already standing. They are reference polylines — exterior by the
  outer face, interior by the centreline, the ArchiCAD/Revit convention — and
  carry a construction from
  a catalog (brick, ceramic block, foam concrete, timber, frame, glazing),
  each with its typical thickness typed over freely. The plan fills every
  wall's mitred body (glazing stays translucent), and once a building has
  walls the 3D view extrudes them instead of the solid footprint. A drawn
  wall reshapes like everything else here — squares drag corners, rings add
  them, a double click removes one — and it **closes into a ring**: draw the
  line back onto its start, drag an end onto the other end, or press the
  button, and the contour seals with a mitred seam; Alt+double click cuts a
  ring back open at any corner, or splits an open wall in two, doors and
  sockets staying exactly where they hung
- **Storeys stack** with a switcher right in the mode bar. Each one has a
  geometry of its own: its **floor slabs** are objects, and a slab is simply a
  shape — the same rectangle, circle or ellipse the plot is drawn with, rubber
  banded out, dragged, resized and turned by the very same grips, or laid as a
  default plate with a single click. Its edges snap to the walls of the storey
  below without holding a modifier, the way OSNAP works in a CAD editor, so
  «flush with the room downstairs» is a gesture rather than four typed numbers.
  The union of a storey's slabs is its outline, and its walls are held inside
  it — a wall belongs to the floor it stands on and cannot wander off it. That
  is also what lets a floor reach past the storey below with nothing on it: a
  balcony, a canopy deck, the overhang. A new storey inherits copies of the
  slabs beneath it, and a storey drawn before slabs existed still takes its
  outline from the loop its walls close —
  whatever stays uncovered becomes exposed ceiling, zoned as plain membrane,
  a walkable **terrace** or a **green roof** (tinted on the plan, laid as
  real covers in 3D). Every storey carries a floor slab and a roof slab, so a
  house reads as a solid and casts a solid shadow; ±0.000 stands on the
  цоколь, storeys stack floor to floor, and the panel states each one's clear
  height, its level and how far its floor is above the ground. The storey
  below ghosts through while you build on top, storeys the editor is not
  aimed at ghost in 3D as well — while still casting their full shadow,
  because a shadow belongs to the house and not to what is being edited — and
  new buildings start from presets: house, shed, carport on piers
- **Stairs** come from a catalogue like furniture — straight, quarter turn,
  half turn, spiral — and only their intent is stored: the run derives from
  the floor-to-floor height at a comfortable riser, so raising a storey
  re-treads every stair standing in it. A stair cuts its own stairwell in the
  floor above, by headroom rather than by outline, so the floor over the
  lower flight — where the wardrobe upstairs stands — is left alone. One
  placed outside its storey is a porch: it climbs from the graded ground to
  the floor. Stairs move, turn and mirror like any other object, and the plan
  states them the way a floor plan does: treads, the climb arrow and «UP · N»
- **Overhangs and canopies**: an upper storey may reach past the one below —
  its floor is drawn solid, its soffit closed underneath — and **posts** hold
  it up, each deriving its own length from the floor or the graded ground
  beneath it up to one shared ceiling datum, so a canopy on a slope stands
  level. A storey with posts and no walls is a carport: a deck on posts, with
  a carport's shadow rather than a block's
- **Placing is one-shot**: a stair, a post, a slab, a tree hands the pointer
  straight back to the select tool with itself selected, so the next click
  adjusts it instead of dropping a second one beside it. Two kinds of tool stay
  in hand — those that draw a run (walls, paths, trenches, elevation marks),
  whose gesture already says when it is finished, and furniture and electrics,
  because furnishing a room and wiring a storey are runs of placements in their
  own right
- **Pitched roofs** crown the top storey — gable, hip or shed — from four
  numbers: the shape, the slope, the overhang and which way the ridge runs.
  The roof is one height function over the plan and every slope is a plane, so
  an L-shaped house gets a roof cut to its own outline rather than to its
  bounding box, a hip over a square plan collapses into a pyramid on its own,
  and the plan draws the ridge, the hips and the slope arrows as the lines
  where those planes actually meet. It is built as a solid — slope, soffit,
  fascia and the gable walls that close the ends — because a one-sided roof
  casts the wrong shadow and shows a hole from underneath
- **Fireplaces and stoves** stand as objects, and their **flue derives**: it
  rises behind the firebox, opens the floor of every storey above it and comes
  out over the roof at the height the norm asks for — half a metre above a
  ridge it stands close to, level with it a little further out, clearing its
  own stretch of slope beyond that. Drag the fireplace and the chimney follows,
  because there is nothing else to drag
- **Ventilation is planned per storey**: shafts are planted on the floor they
  start on and drawn on every floor they pass through — the chimney in the
  middle of the upstairs bedroom is a thing to plan the walls around, so the
  plan shows it. A **sauna** is a room type that asks for both: a shaft of its
  own (a wet or fired room may not share one) and a stove to heat it
- **Findings** collect every advisory into one list you can walk: a wardrobe
  standing over a stairwell, a wall crossing it, a stair outside the
  comfortable bands, an overhang past what ordinary framing carries with no
  post under it, a storey too low to live in. Each row names the rule and
  takes the editor to the place it is about — nothing is ever blocked
- **Furniture** places from a catalogue of 33 real-sized pieces — beds to a
  kitchen run, IKEA-class wardrobes, dressers and a TV stand, fridge, stove
  and washing machine, plus plumbing fixtures that
  already know their utility system — picked from a fly-out on the left rail
  and placed onto the active storey. Dragged near a wall, a piece turns its
  back and snaps flush against the face (Alt suspends the magnet); a grip
  ahead of its front turns it, and an elevation field hangs a boiler on the
  wall. In 3D every piece is a sculpted low-poly model built to its exact
  catalogue dimensions — a toilet with its bowl and tank, a shower with its
  glass and riser, a bed with mattress and pillows — instanced the way the
  cars and trees are
- **Electrical** wires the storey for real: the panel, outlets and switches
  hang on walls at their code heights, lights go on the ceiling, and a
  two-click connect tool builds the circuits — panel to consumers, switch to
  light. No wire is ever drawn by hand: each run derives along the walls
  through their junctions, the way wiring is actually laid, and re-routes
  itself when a device slides
- **Doors and windows** hang on walls and slide along them — never placed
  free — with presets for a door, a window on a sill, and a floor-to-ceiling
  window; in 3D they cut real holes, with the masonry under each sill and
  the lintel over each head kept. **Rooms are never drawn**: the walls cut
  the footprint into regions, each gets a type (kitchen, bathroom, sauna…),
  wet zones tint the floor, and every room is captioned with its area
- Any number of named structures, each with its own footprint, pad and walls,
  and each standing on a **foundation** chosen rather than drawn — slab, stem
  wall or piers, with its depth and plinth typed in metres. The concrete solid
  is derived from the footprint and rendered in 3D as a ledge skirting the
  walls; its volume joins the earthworks report
- **Utility entries** mark where each system comes into the house — power,
  network, water, sewer as sleeves cast into the foundation, gas on the
  facade only (the way the norms have it) — drawn as lettered badges on the
  footprint outline, each with its norm-derived default depth
- **Site utility lines** are clicked out across the plot from those entries —
  a click near the right entry snaps onto it — and the editor knows the
  digging codes as data: water goes below the frost line (an editable site
  setting), cables take their standard cover, a sewer falls at the
  recommended slope for its bore, so its depth along the run is derived
  against the terrain rather than typed. The panel reads back trench volume
  and advisory findings — a run risen too shallow, thin cover under a
  driveway, two systems trenched closer than the code seats them. A drawn
  line reshapes like a garden path: squares drag its bends — near the right
  entry a bend snaps onto it — rings add new ones, a double click removes

**Analysis:**
- Slope shading and D8 flow arrows show where water runs
- Cut / fill under the house pad is reported in cubic metres and coloured
  over the ground — warm where soil comes out, cool where it goes in
- Both overlays are rasterized once on the CPU and handed to the plan and the
  3D view alike, so the two can never disagree about what a colour means

**Export:** the plan as JSON (import reads it straight back) and as a PNG
sheet of the whole plot at a round scale, drawn by the same function that
paints the editor — compass and scale bar included, editing chrome left out.

The parked cars render from a palette-textured low-poly SUV
([Kenney car kit](https://kenney.nl/assets/car-kit), CC0) loaded through the
feature's own minimal GLB parser and fitted exactly to the plan's car
footprint; a sculpted stand-in covers the load.

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
