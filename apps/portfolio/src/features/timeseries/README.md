# Timeseries

Showcase of `@frozik/charts`: WebGPU charts on one shared device — live series, candles, snapshots — built as a headless kernel plus extensions.

Live: [https://frozik.github.io/portfolio/timeseries](https://frozik.github.io/portfolio/timeseries) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/timeseries/`; the library lives in [`libs/charts`](../../../../../libs/charts/README.md).

The feature is the library's living documentation, laid out like every
other one: `domain/` (the noise the series are made of, the curve of the
snapshot page), `infrastructure/` (a time series source over that noise that
keeps the contract of a real server, the IndexedDB cache of the demo),
`application/` (the charts of every page, the `sync` extension, the MobX
store with the page and the switches of the debug panel), `presentation/` (the shell and
its pages).

The charts get the whole page. The name of the page shown stands in the top
bar; pressing it opens the row of pages — overview, scales & panes, marks,
live, snapshot, synced — and pressing it again puts the row away. Each page
in the row has an info icon: hovering, focusing or tapping it says what the
page shows.

**Overview** — a 2×2 grid of charts over a year of synthetic data, each with
its own series and its own stretch of the year:

- a line of one series under translucent candles of another — two sources
  on one chart; the candles decide the scale, and the line is aggregated by
  the same step
- candles: a body from open to close, a wick from the low to the high
- a line whose thickness follows the value — calm stretches thin, high
  ones thick
- rhombus markers coloured by threshold bands (blue / green / grey /
  orange / red), so extreme values are spotted at once

Every series is multi-octave simplex noise, so zooming in keeps finding
detail while the large shape stays where it was. How dense the elements
are depends on the width of the chart: the scale is the finest step of a
fixed grid (1 ms … 240 days) at which an element still gets the pixels its
style asks for, so a candle never touches its neighbour. What the overview
has read is kept in IndexedDB: opened again, the page shows its history at
once and asks the source only for what it has not seen.

**Scales & panes** — one chart, three panes on a shared time axis. The price
pane holds four series against four value scales: candles and a benchmark
labelled in per cent on the right, a curve on a logarithmic scale and a
stepped rate on the left — the outer scale of each side in a gutter of its
own, each scale's labels in the colour of its series. The scales carry the
usual axis properties: a title at the top end, the rate running downwards
(inverted), the volume starting at a fixed nought with thousands written
short, the histogram fixed at both ends. Under the price pane a pane of
volume columns and a pane with a histogram that stands on nought, green
above it and red below. A legend in the corner of every pane reads each
series at the element the crosshair snaps to; a limit and a support level
are marked across the price pane, three events on the time axis. The
crosshair writes the pointed height on every scale of the pane it is over.

**Marks** — every way to draw, over a fixed set of sixty hourly elements:
an area with a line along its edge and stairs over the same points, both
broken where three points are missing; candles, and beside them a second
series of candles a sixth of a turn ahead drawn as a line through their
four points with a ring on each; the circle and all thirteen polygon
figures of the marker in three rows that go through what fill and stroke can
do — fill alone in a colour and a size of its own, fill under a stroke of
another colour one to four pixels thick, and the same figure hollow, which
is nothing but a fill at alpha nought under a stroke; behind them, rings on
the points of the first chart, missing where the points are; a line whose thickness
follows the value, with an outline.

**Live** — a series that ends at this very moment. History is read by
request, everything later arrives through a subscription, and the two are
joined without a gap or a duplicate. The candle of the interval that has not
closed yet is shown growing. The view follows the newest element — easing
to it rather than jumping — until you
leave for history, says which of the two it is doing, and a button brings it
back — with a tenth of the width left free to the right of the newest element. Three more buttons swap the look of the line — line, stairs, area — on
the live chart: the source is not asked again, the elements already in
memory are styled anew.

**Snapshot** — an ordinary chart: a numeric X axis and a set of points the
application holds and replaces as a whole a few times a second. The same
area style, grid, axes and gestures as over time.

**Synced** — two charts of different series sharing one viewport; the
position under the pointer on one is marked on the other by a dashed line.
The `sync` extension is written in the feature from what the library
exports — the extension contract, the kernel, a painter — without touching
the library.

**Interactions:**
- Every chart carries a round button in its bottom right corner that
  stretches it over the whole screen from where it stands and puts it back:
  the way to read one chart on a phone. It is the same canvas in both
  states, so the view and the data stay; at the new width the chart picks a
  finer scale by itself. The frame is the application's, shared with the
  table demo — the library knows nothing of it
- Drag to pan with inertia, scroll or pinch to zoom, spring-animated
  transitions on zoom and resize
- Time axis labels scale from seconds all the way out to months as you
  zoom; the live page writes them in the local time zone
- A crosshair follows the mouse or pen: thin dashed lines across the plot,
  a thick bright crossing under the pointer, and the exact position and
  value written on dark blue where the axis labels sit. On touch, a finger
  resting for a moment takes the crosshair with it until it lifts; moving
  straight away pans as usual, and a second finger pinches
- A shimmering bar along the bottom edge under every range still on its
  way; the "Loading delay" switch makes the sources answer like a slow
  server. "Source failures" takes the server down: requests are rejected
  and the subscription stops delivering. What was already read stays on
  screen; from the last moment the source answered, the plot is washed in a
  faint red with a soft glow travelling across it, over a red bar along the
  bottom edge. While it is down the chart keeps asking, quietly and only
  for what is on screen — a range stays red rather than flickering back to
  loading, and what is scrolled out of view is no longer tried. Switched
  back, the subscription starts anew, what failed is read, and the wash goes
- Debug overlay with the frame rate of the stage and the renderer in use.
  "Canvas 2D only" takes the GPU away: every page is then drawn by the 2D
  canvas alone, as it is by itself on a device without WebGPU. On a local
  run there is also a switch that marks where each chunk of the data
  texture begins
- Fullscreen with landscape lock on mobile

**Behind the scenes:**
- Two ways to draw, one description of a chart. Where the device gives a
  GPU, WebGPU draws the grid and the series and a 2D canvas above it draws
  the text; where it does not — an old phone, a browser without WebGPU, a
  blocklisted driver — the 2D canvas draws everything. Every mark and
  every drawing extension carries a painter for both, and the stage picks
  who draws. A GPU device lost while the page is open is survived the
  same way: the 2D canvas takes the series over
- One WebGPU device, one series pipeline and one frame loop drive every
  chart of a page. Each chart has its own canvas context configured on that
  device, so a frame is resolved directly into the visible canvas — no
  offscreen canvas, no bitmap transfer — and the whole grid goes to the GPU
  as a single submission. WebGPU has no per-page context limit (the 8–16
  ceiling belongs to WebGL), so the chart count is bounded by memory
- Two stacked canvases per chart: the GPU canvas draws the dashed grid and
  the series, a transparent 2D canvas above it draws the axes, labels,
  crosshair and loading bars. Text stays on the 2D canvas because it is
  sharper there. The overlay keeps what it painted and repaints only when
  one of its painters says its picture is out of date
- Elements live in an integer texture: time as whole seconds and the
  nanoseconds within the second, a value as a float32 and what its rounding
  lost. The shader subtracts the viewport before converting to pixels, so a
  deep zoom on sparse data neither jitters nor shifts
- One shader draws every mark — line, stairs, area, marker figures,
  candles — and branches on a uniform: a new chart type is a function in
  the shader, not another pipeline. Fill and stroke are separate: a marker
  can be hollow, a line can carry an outline
- A gap in the data is a `NaN`: the line and the area break on it, no
  marker is put there, the autoscale ignores it
- Series, grid, ticks and crosshair share one mapping from position and
  value to pixels, so a label names exactly what is drawn under it
- Grid lines are snapped to whole device pixels; the weight a half-pixel
  line would have is carried by its opacity
- 4× MSAA on every chart, the anti-aliasing textures cached by size
- The frame rate drops to 10 fps when nothing is moving and returns to 60
  the instant you interact or data arrives
- The demo source keeps the contract a real server would — bounds,
  direction, a soft limit that never splits a moment, a subscription that
  starts where history ends — and is checked by the library's contract
  test suite, the same one a real adapter would run
