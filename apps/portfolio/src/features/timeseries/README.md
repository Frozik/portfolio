# Timeseries

Four interactive time-series charts on one shared WebGPU device, streaming synthetic data.

Live: [https://frozik.github.io/portfolio/timeseries](https://frozik.github.io/portfolio/timeseries) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/timeseries/`.

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
