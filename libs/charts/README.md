# @frozik/charts

Charts built as a small headless kernel plus extensions. The kernel knows a
viewport, a list of series and a frame; ticks, grid, axes, crosshair, pan and
zoom, autoscale, following the live edge are extensions of it, so nothing
that is not plugged in runs or is bundled. Drawing is a separate layer: a
WebGPU backend that draws every chart of a page with one device, one frame
loop and one submission a frame, and a Canvas 2D backend that draws text and
pointer-driven marks above it — or a whole chart on its own.

The design specification (in Russian, kept with the repository's other design
documents under `.claude/plan/design/charts/spec.md`) covers the principles,
the data kinds, the texture layout, the shader and the decisions taken; the
`§` citations in the source refer to it.

```
src/
  core/         kernel: viewport, series, frame, extension registry, stage; host ports (pointer, size, frames)
  data/         data kinds: timeseries (history + subscription), snapshot (a window that is replaced), staticData
  marks/        <mark>/core.ts, style.ts — line, area, marker, candle: what is drawn, without a backend
  extensions/   <id>/core.ts — the headless part of every extension
  webgpu/       backend: data texture, chunks, the assembled series shader, mark and extension painters
  canvas2d/     backend: surface, text, axes / crosshair / loading / grid painters, every mark
  universal/    marks and extensions with painters for both backends; the choice of backends a device can run
  dom/          the browser as a host: pointer source, size tracker, rAF scheduler, IndexedDB cache
  react/        ChartStageProvider, Chart, useChart, useChartValue
  theme/        light theme, themeFromCss (the dark default lives in core)
  testing/      fake host, in-memory sources and caches, the source contract suite
```

`core/`, `data/`, `marks/` and `extensions/` compile without DOM and WebGPU
types (`tsconfig.headless.json`) and are tested by feeding pointer events,
sizes and time straight into the ports.

```ts
const stage = await createStage({ backends: availableBackends(), scheduler: rafScheduler });

const prices = timeseries(priceSource, { key: 'btc-usd', cache: { persistent: indexedDbCache({ name: 'charts' }) } });

const chart = createChart({
  x: { domain: timeDomain, start: from, end: to }, // bigint nanoseconds from the Unix epoch
  series: [
    series({ id: 'price', data: prices, style: lineStyle({ color: BLUE, size: 2 }) }),
    series({ id: 'ohlc', data: prices, style: candleStyle({ width: 8, gap: 2 }) }),
  ],
  extensions: [
    ticks({ x: timeTicks() }), grid(), axes(), crosshair(),
    panZoom(), smoothZoom(), bounds({ minRange: MINUTE }),
    autoScaleY(), followTail(), loadingIndicator(),
  ],
});

const unmount = mountChart(stage, chart, { input: overlay, canvases: { webgpu: canvas, canvas2d: overlay } });

chart.viewport.setTarget({ start, end });
chart.series.setStyle('price', stairsStyle({ color: BLUE }));
chart.crosshair.point; // the slice of an extension, typed by its id
chart.on('data.failed', ({ seriesIds, failure }) => {});
```

In React the stage comes from `<ChartStageProvider backends={…}>` and
`<Chart model={chart} />` renders a canvas per backend and mounts the model.

## What is where

**X axis.** The kernel is generic over the coordinate: an `IAxisDomain`
gives it `compare`, `diff` and `add`. `timeDomain` is `bigint` nanoseconds,
`numberDomain` a plain number; the same extensions and marks work over both.

**Value scales and panes.** A chart has as many value scales as it names:
each has a side (left or right), a kind (linear or logarithmic), labels (the
value, or its change in per cent from the first value in view) and a colour,
and each series is measured against the scale it names. Scales live in
panes — horizontal bands with a shared X axis, stacked by weight. The first
scale on a side is written inside the plot; every further one gets a gutter
beyond it. Without `scales` a chart has one, on the left.

| Scale option | What it does |
| --- | --- |
| `id`, `pane`, `side` | the name series refer to, the pane it lies in, `left` or `right` |
| `kind` | `linear` or `log` |
| `labels` | `value`, or `percent` from the first value in view |
| `min`, `max` | a fixed end; an end not given follows the data (`autoScaleY`) |
| `padding` | room beyond the data at the ends that follow it, in place of the autoscale's own |
| `inverted` | the minimum at the top |
| `visible` | `false` draws no line, ticks or labels and takes no gutter; the series are drawn all the same |
| `title` | what the scale measures, written at its top end |
| `format` | how a value is written on ticks, under the crosshair and on levels |
| `color` | the colour of its labels |

**Reading a chart.** `legend()` writes the name of every series and the
values of its element nearest to the pointer — one for a point, open, high,
low and close for a candle. `crosshair({ snap: ['price'] })` stands the
vertical line on the nearest element of the series it names. `annotations()` marks levels across a pane and events
on the X axis, and lets the application change them on a live chart.

**Data.** A series is data plus a style processor. Data comes in two shapes —
points and candles — always as columns. `timeseries(source)` reads history by
range and the new by subscription: it keeps the intervals it knows whole,
asks only for the holes, never splits a moment between two answers
(`softLimit`), picks the scale from a fixed grid of nineteen steps by the
pixels an element gets, and reports failures with gRPC codes. `snapshot(source)`
holds one window over data that changes and replaces it whole.
`staticData(batch)` is a fixed set. A source is checked against its contract
with `describeTimeseriesSource` from `testing/`.

**Caches.** What a time series has read stays in memory under a budget in
elements; `indexedDbCache` keeps it between sessions when the series has a
`key`. The data texture is the WebGPU backend's own cache.

**Marks and style.** `lineStyle`, `stairsStyle`, `areaStyle`, `markerStyle`
(circle, ring and thirteen polygons), `candleStyle`, `columnStyle` (volume
bars from the bottom of the pane, a histogram from nought). A style processor names
the shape it draws from and turns a run of data into fill and stroke — a
colour and a size, constant or per element. Lines, areas and markers can be
drawn from candles too (through their four points); candles only from candles.
`chart.series.setStyle` swaps the look on a live chart.

**WebGPU.** Each chart has its own canvas context on the shared device.
Elements live in an `rgba32uint` texture — time as seconds and nanoseconds,
values as a float32 and what its rounding lost — so deep zooms neither jitter
nor shift. One pipeline draws every mark: its shader is assembled from the
marks in use and branches on a layer uniform.

**Two backends, one chart.** The 2D canvas has two jobs. Above WebGPU it is
a transparent overlay for what a GPU draws badly — text, and with it the
axes and the crosshair. Alone it draws everything, for devices without
WebGPU. Marks and drawing extensions imported from `universal/` carry a
painter for each backend; the stage has the bottom backend of its stack draw
the series, and gives a contribution offered for several backends to the
lowest one that is there. `availableBackends()` is WebGPU under a 2D overlay
where a device can be had and the 2D canvas alone where it cannot. If the
GPU device is lost while the page is open, the stage drops that backend and
the 2D canvas takes the series over. Import
from `webgpu/` or `canvas2d/` instead to bundle one backend only.

**Extending.** A new mark is a `core.ts`, a style and a painter per backend;
a new extension is `defineExtension` or an object with `create(kernel)`, with
a painter attached through `withPaint` when it draws; a new data kind
implements `ISeriesData`. None of them touches the kernel.

The shaders are imported with Vite's `?raw`; the package ships sources and is
meant to be built by a Vite consumer.
