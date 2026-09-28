# Timeseries

Four interactive time-series charts on one shared WebGPU device, streaming synthetic data.

Live: [https://frozik.github.io/portfolio/timeseries](https://frozik.github.io/portfolio/timeseries) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/timeseries/`.

A 2×2 grid of interactive time-series charts, each with its own
visualization style, all rendered by a single shared WebGPU device
straight into the canvas of each chart.

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
- A crosshair follows the mouse or pen: thin dashed lines across the plot,
  a thick bright crossing under the pointer, and the exact time and value
  written on dark blue where the axis labels sit
- Debug overlay with FPS counter and a toggle to visualize the data
  block boundaries
- Fullscreen with landscape lock on mobile

**Behind the scenes:**
- One WebGPU device, one set of pipelines and one frame loop drive every
  chart. Each chart has its own canvas context configured on that device,
  so a frame is resolved directly into the visible canvas — no offscreen
  canvas, no bitmap transfer, no 2D `drawImage` — and the whole grid goes
  to the GPU as a single submission. WebGPU has no per-page context limit
  (the 8–16 ceiling belongs to WebGL), so the chart count is bounded by
  memory, not by contexts
- Two stacked canvases per chart: the GPU canvas draws the dashed grid and
  the series, a transparent 2D canvas above it draws the axes, labels and
  loading bars. Text stays on the 2D canvas because it is sharper there.
  The overlay keeps what it painted and repaints only when the viewport or
  size changes, or while a loading bar is animating
- The crosshair lives on the 2D overlay too: it is pointer-driven UI, not
  data, its labels have to be 2D text anyway, and they share the font and
  the decimals of the ticks
- Series, grid, ticks and crosshair share one mapping from time and value
  to pixels, so a label names exactly what is drawn under it
- Grid lines are snapped to whole device pixels; the weight a half-pixel
  line would have is carried by its opacity
- 4× MSAA on every chart. The anti-aliasing textures are cached by size:
  charts of the same size share one, charts of different sizes each get
  their own, and a size nobody draws at any more is freed
- FPS gates down to 10 fps when nothing is moving and ramps back to 60
  the instant you interact
- Data arrives in fixed 256-point blocks that the GPU stitches into a
  continuous line — the architecture maps 1:1 onto a real server-backed
  data source if we ever swap the noise generator out
