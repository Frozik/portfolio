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
  x: { domain: timeDomain({ timeZone: 'Europe/Moscow' }), start: from, end: to }, // bigint nanoseconds from the Unix epoch
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

chart.viewport.x.setTarget({ start, end });
chart.viewport.scale('price').hold({ start: 90, end: 110 });
chart.series.setStyle('price', stairsStyle({ color: BLUE }));
chart.crosshair.point; // the slice of an extension, typed by its id
chart.on('data.failed', ({ seriesIds, failure }) => {});
```

In React the stage comes from `<ChartStageProvider backends={…}>` and
`<Chart model={chart} />` renders a canvas per backend and mounts the model.

## What is where

**X axis.** The kernel is generic over the coordinate: an `IAxisDomain`
gives it `compare`, `diff` and `add`. `timeDomain({ timeZone })` is `bigint` nanoseconds
from the Unix epoch, told in the zone it names (UTC by default) wherever time
is shown — ticks, crosshair, a schedule;
`numberDomain` a plain number; the same extensions and marks work over both.
`timeTicks()` stands ticks on round moments of the calendar and the clock at
the finest step whose labels fit, and names a tick that begins a larger unit
by it — the year at January, the month at its first (days are counted from
it), the date at midnight — so a row of labels reads without a doubt what
each belongs to.

**Cuts and sessions.** Stretches of the X axis can be taken out of view:
`x.cuts` is a list of `{ from, to }` in world coordinates, or a `schedule()`
over the axis of time — weekly and single entries, each opening or closing
the time it names (`closed` always wins; with any `open` entry the rest of
time is closed), every boundary read in its own zone, else the schedule's,
else the axis's. The chart runs on a virtual axis where every cut has no
length; `chart.viewport.x.mapping` translates (`toVirtual`, `toWorld`,
`cutsIn`), and `chart.setCuts(definition)` swaps the cuts on a live chart,
keeping the dates in view and reading the data anew. Data is cut at the
source's door: an element stays while any of its interval is open — the
interval is `[x, x + step)` or `(x − step, x]` by the data's `aggregateTime`
— and takes the open part of the axis; a line breaks where a cut falls
between two elements' intervals. A long closed stretch is asked round rather
than through (`requestWorth`); the source gets the cuts inside a request as
`skip`, and one that leaves them out is asked whole from then on. `cuts()`
draws every cut in view as a zigzag seam under the series; ticks and the
crosshair label the edge after it.

```ts
x: {
  domain: timeDomain({ timeZone: 'Europe/Moscow' }),
  cuts: schedule({
    entries: [
      { kind: 'weekly', effect: 'open', days: [Monday, …, Friday], from: '09:00', to: '23:00' },
      { kind: 'weekly', effect: 'closed', days: [Monday, …, Friday], from: '13:00', to: '14:00' },
      { kind: 'once', effect: 'closed', from: '2026-05-11T00:00', to: '2026-05-12T00:00' },
      { kind: 'weekly', effect: 'open', days: [Monday], from: { at: '07:00', timeZone: 'Australia/Sydney' }, to: { at: '17:00', timeZone: 'America/New_York' } },
    ],
  }),
  start, end,
}
```

**Viewport.** Every axis — the X axis and each value scale — is an
`AxisViewport`: the range drawn (`current`), the range an animation heads
for (`target`), whether a hand holds it, and a revision. `chart.viewport.x`
and `chart.viewport.scale(id)` are the same thing over different
coordinates, so the policies that move them are the same too: `panZoom`
writes ranges, `bounds` constrains them, `autoScaleY` sets the target of a
scale from the data, `smoothZoom` eases every axis to its target, and a scale
held by hand (`scaleZoom`) is one the autoscale skips.

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

`scaleZoom()` lets the pointer work on the scales: dragging the strip of a
scale stretches its range about the middle, the wheel over it about the
value under the pointer, and with Shift held both move the scale instead;
on the plot with Shift held a drag moves every
scale of the pane and the wheel stretches them about the value under the
pointer; and two fingers on the plot move the scales by their
middle and stretch them by their vertical spread while `panZoom()` pans and
zooms the X axis by the same fingers sideways. A plain drag is the pan along
X, however much it strays up or down. A scale touched by hand keeps its
range however the chart moves along X; a double tap on a scale gives it back
to the autoscale, a double tap on the plot every scale of the pane.

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
marks in use and branches on a layer uniform. The texture is laid out as
follows (`webgpu/slot-layout.ts`, `texel-encoding.ts`, `data-texture.ts`,
`chunk-store.ts`, `shaders/common.wgsl`).

*Why a texture.* A series is drawn by instancing: one instance per element,
and the vertex shader reads the element — and its neighbours, for a line
segment or a bar's width — by index. A texture is the one GPU resource that
can be grown, written in parts and read at any index from the vertex stage
on every device; and `rgba32uint` keeps every channel lossless: integers as
they are, fractions as the bits of a float32 (`bitcast` in the shader).

*Slots and chunks.* The texture is 2048 texels wide and starts at four
rows, doubling as it fills up to 512 rows (`maxRows`), which is a million
texels — the texture is replaced when it grows, so bind groups made for the
old one are remade. It is cut into slots of 256 texels, eight to a row. A
run of data is split into chunks of as many whole elements as a slot holds
— 128 points or 64 candles — and each chunk is written into one slot with a
single `writeTexture`. A chunk is written when it is first drawn and again
only when its run's revision or its style changed; between frames nothing
is uploaded. The slots are an LRU pool: at the ceiling the slot touched
longest ago is taken for a new chunk, and the chunk that held it is written
again from the run in memory the next time it is drawn.

*Texels of an element.* A point takes two texels, a candle four; the last
texel of either is its paint.

| Texel | `r` | `g` | `b` | `a` |
| --- | --- | --- | --- | --- |
| point 0 | position, high part | position, low part | value, high | value, low |
| point 1 | fill size (float bits) | fill colour (RGBA8) | stroke size | stroke colour |
| candle 0 | position, high | position, low | open, high | open, low |
| candle 1 | close, high | close, low | low, high | low, low |
| candle 2 | high, high | high, low | — | — |
| candle 3 | fill size | fill colour | stroke size | stroke colour |

*Two parts, not one.* A float32 has 24 significant bits: enough for a
screen, nowhere near enough for a value of 50 000.123 456 or a position
that is a nanosecond on a year. Every value is written as the nearest
float32 and the remainder the rounding lost, another float32 — about 48
significant bits together. The shader never adds the two parts back: it
subtracts the scale's minimum from each part separately and only then adds,
so a value close to the minimum keeps its small bits and never rounds to
the one float32 that would make it jitter as the view moves.

*Time.* A position on the axis of time is `bigint` nanoseconds; in the
texture it is whole seconds in `r` and the nanoseconds within the second in
`g`, both as integers. The seconds wrap round 32 bits — before 1970 and
after 2106 alike — because the shader only ever subtracts the view's start
from them, and a wrapped difference is exact while the two moments are less
than 2³¹ seconds apart; that is the 68 years behind the axis's `maxSpan`.
The difference is carried from nanoseconds into seconds in integers and
turned into a float only at the end, as a fraction of the visible span. A
numeric axis uses the two-part float instead, with the same subtract-first
rule.

*Gaps.* A missing value is a NaN in the data and stays a NaN in the
texture; the shader tells it by its bits (`isGap`), since a compiler may
assume a float NaN never happens. The technical NaN a cut of the axis puts
between two elements (sessions) goes the same way: it is written like any
other gap and breaks the line like one.

*Paint.* The style processor turns a run into a fill and a stroke — a size
and a colour each, constant or per element — and they travel in the element's
last texel: the sizes as float bits, the colours packed as RGBA8, unpacked
and premultiplied in the shader. Because the paint sits inside the element,
a new style rewrites the run's chunks; a run that grew at its end rewrites
only the chunk that grew.

*Reading back.* A storage buffer beside the layer uniform carries the
chunks of the run as `(texel, end)` pairs — the first texel of each chunk and the number of
elements up to and including it. `elementTexel(index)` finds the chunk by
binary search over those ends and steps to the element; the vertex shader
reads the element, and for a line or a bar the one before or after it, by
`textureLoad`, with the texel index split into column and row by the
texture width. The bar width of an element on a cut axis comes from its
neighbour the same way, so what the shader draws needs no second pass over
the data on the CPU.

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

## Agent tools (WebMCP)

`agent/` lets a browser agent drive charts through
[WebMCP](https://developer.chrome.com/docs/ai/webmcp), headless like the
kernel. `defineChartTarget({ chart, codec })` wraps one chart behind a uniform
interface, positions travelling as text: `timeCodec(timeZone)` reads anything
the date picker reads (ISO, "yesterday 10:00") and prints local date-times,
`numberCodec` plain numbers. `defineChartTools({ prefix, targets })` turns the
targets into tools — list the charts, zoom and scroll along X, go to a
position or a range, fit the data, stretch, hold and reset value scales,
follow live data, read values at a point. The commands write the way the
gestures do: zoom eases the target round an anchor as the wheel does,
scrolling shifts like a drag, a scale is held by hand and released as a double
tap releases it; positions are world coordinates, the cuts taken out and put
back on the way.
