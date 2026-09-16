# Binance Orderbook

A Bookmap-style live depth-of-market heatmap over a real Binance WebSocket feed, with trades and an hour of history.

Live: [https://frozik.github.io/portfolio/binance](https://frozik.github.io/portfolio/binance) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/binance-view/`.

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
  side (bid / ask); over a candle the same popup adds its OHLC, the
  change and range in basis points and the MA5 / MA10 values, and the
  candle lights up
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
