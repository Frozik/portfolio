import type { Milliseconds } from '@frozik/utils/date/types';

/** Preferred data-texture width (cells). Requires `maxTextureDimension2D >= 16384`. */
export const TEXTURE_WIDTH_PREFERRED = 16384;

/** Fallback data-texture width when 16384 is not supported. */
export const TEXTURE_WIDTH_FALLBACK = 8192;

/** Number of texel slots per snapshot (100 real levels + 28 padding). */
export const SNAPSHOT_SLOTS = 128;

/** Number of snapshots per block (≈ 2 min 8 s at 1 s/snapshot). */
export const SNAPSHOTS_PER_BLOCK = 128;

/** Flush trigger in snapshots: accumulate 16 before writing to GPU/IDB/RBush. */
export const FLUSH_EVERY_SNAPSHOTS = 1;

/** Floats per texel (rgba32float). */
export const FLOATS_PER_TEXEL = 4;

/** Rolling-window cap on IndexedDB: 1 hour of data ≈ 29 blocks. */
export const MAX_HISTORY_BLOCKS = 29;

/** Initial GPU-texture capacity in blocks (grows to MAX_GPU_BLOCKS). */
export const INITIAL_GPU_BLOCKS = 32;

/** Absolute GPU-texture capacity in blocks. */
export const MAX_GPU_BLOCKS = 1024;

/** Pixels per millisecond on the X axis (20 px/s, 20 px/cell). */
export const PIXELS_PER_MILLISECOND = 0.02;

/** Lerp speed for viewport animation (target → view). */
export const VIEW_LERP_SPEED = 0.18;

/** Pan inertia damping factor per frame. */
export const PAN_INERTIA_DAMPING = 0.95;

/** Minimum pan velocity in ms/frame before inertia stops. */
export const PAN_INERTIA_MIN_VELOCITY_MS = 0.5;

/** Distance (ms) within which viewport is considered "following" latest data. */
export const FOLLOW_EPSILON_MS = 1000;

/** Snap threshold for lerp (ms): when |delta| < this, snap to target. */
export const VIEW_SNAP_THRESHOLD_MS = 2;

/**
 * Padding (ms) to the right of last displayed snapshot when following.
 * Equals `updateSpeedMs / 2` so the latest cell's right edge lands
 * exactly on the left border of the Y-axis panel — no visible gap
 * between live data and the price strip. A larger value would leave
 * a dark strip that only shows up in follow mode (history pan has no
 * extra padding), which looks like a bug.
 */
export const FUTURE_PADDING_MS: Milliseconds = 500 as Milliseconds;

/** Default Y-viewport min at init (before any data arrives). */
export const DEFAULT_PRICE_MIN = 0;

/** Default Y-viewport max at init. */
export const DEFAULT_PRICE_MAX = 1;

/** Initial number of price levels visible vertically (starts zoomed in). */
export const INITIAL_VISIBLE_LEVELS = 40;

/** Tightest view (fewest levels visible). Matches the initial zoom. */
export const MIN_VISIBLE_LEVELS = 20;

/** Widest view (most levels visible). */
export const MAX_VISIBLE_LEVELS = 128;

/** Multiplicative zoom factor applied per wheel tick (10% per notch). */
export const WHEEL_ZOOM_STEP = 0.1;

/** Lerp factor used to glide `visibleLevels` toward its target each frame. */
export const ZOOM_LERP_SPEED = 0.2;

/** Snap threshold in levels: when |delta| < this, snap to target. */
export const ZOOM_SNAP_THRESHOLD_LEVELS = 0.01;

/** Number of attempts to resync on orderbook sequence gap. */
export const MAX_SEQUENCE_GAP_RETRIES = 5;

/** Delay between WebSocket reconnect attempts. */
export const RECONNECT_DELAY_MS: Milliseconds = 1000 as Milliseconds;

/** Cap on how many repeat-last interpolated snapshots are emitted in a row. */
export const MAX_INTERPOLATED_SNAPSHOTS = 5;

/** Diagonal stripe period in pixels for marking interpolated cells. */
export const STRIPE_PERIOD_PX = 8;

/** Brightness multiplier applied to darker half of stripe pattern. */
export const STRIPE_DARK_FACTOR = 0.45;

/** Cell alpha at the low end of the magnitude scale (green). Red cells get `1.0`. */
export const CELL_ALPHA_LOW = 0.35;

/** Per-texel channel index that carries the `isInterpolated` flag to the shader. */
export const TEXEL_INTERP_CHANNEL = 3;

/** EMA smoothing factor for magnitude auto-fit (CPU side). */
export const MAGNITUDE_EMA_ALPHA = 0.2;

/** FPS levels for the RAF loop. */
export const FPS_IDLE = 10;
export const FPS_INTERACTION = 60;
export const FPS_FOLLOW_DRIFT = 60;

/** MSAA sample count for anti-aliased rendering. */
export const MSAA_SAMPLE_COUNT = 4;

/** Initial offscreen canvas width (resized before first render). */
export const INITIAL_OFFSCREEN_WIDTH = 1024;

/** Initial offscreen canvas height. */
export const INITIAL_OFFSCREEN_HEIGHT = 768;

/** Axis styling. */
export const AXIS_LABEL_COLOR = '#ccc';
export const AXIS_LINE_COLOR = '#aaa';
export const GRID_LINE_COLOR = '#444';
export const AXIS_FONT_SIZE = 11;
export const AXIS_FONT_FAMILY = 'monospace';

/** Width (CSS pixels) of the right-side Y-axis panel. */
export const Y_AXIS_PANEL_CSS_PX = 150;

/** Background fill for the Y-axis panel. */
export const Y_AXIS_PANEL_BG_COLOR = '#141414';

/** Stroke color for the per-level row dividers inside the Y-axis panel. */
export const Y_AXIS_ROW_DIVIDER_COLOR = '#2a2a2a';

/** Bid-side (buy) volume bar color in the Y-axis panel (RGBA). */
export const Y_AXIS_VOLUME_BID_COLOR = 'rgba(46, 160, 67, 0.55)';

/** Ask-side (sell) volume bar color in the Y-axis panel (RGBA). */
export const Y_AXIS_VOLUME_ASK_COLOR = 'rgba(229, 57, 53, 0.55)';

/**
 * Horizontal inset applied to the volume-bar area inside the Y-axis
 * panel (CSS pixels on each side). Keeps bars from hugging the left
 * divider / right canvas edge.
 */
export const Y_AXIS_VOLUME_BAR_INSET_PX = 4;

/**
 * Minimum bar width rendered for a non-zero volume level, so tiny
 * volumes stay visible at any zoom without being dominated by the
 * widest level on screen.
 */
export const Y_AXIS_VOLUME_MIN_BAR_WIDTH_PX = 2;

/**
 * Samples per block on the mid-price line. Matches `POINTS_PER_SLOT =
 * 256` from the timeseries feature so the GPU texture-slot math is
 * shared between the two. At 1 Hz cadence each block covers 256 s
 * (~4 min 16 s). The mid-price source is the live orderbook itself —
 * every flushed orderbook snapshot yields one mid-price sample via
 * `(bestBid + bestAsk) / 2`, so there is no separate WebSocket
 * subscription and the cadence matches the orderbook's.
 */
export const MID_PRICE_SAMPLES_PER_BLOCK = 256;

/** Flush cadence in samples (1 → live rendering every second). */
export const MID_PRICE_FLUSH_EVERY_SAMPLES = 1;

/**
 * Rolling-window cap in IndexedDB. 16 × 256 × 1 s ≈ 68 min — slightly
 * longer than the orderbook's 1 h so the line keeps up with history.
 */
export const MAX_MID_PRICE_BLOCKS = 16;

/** Mid-price data-texture width in texels (one row = 8 blocks). */
export const MID_PRICE_TEXTURE_WIDTH = 2048;

/** Initial rows in the mid-price GPU texture (2 × 8 = 16 slots → fits the cap). */
export const MID_PRICE_TEXTURE_INITIAL_ROWS = 2;

/** Maximum rows in the mid-price GPU texture (grow-path unused at current cap). */
export const MID_PRICE_TEXTURE_MAX_ROWS = 2;

/** Minimum drawn line width (device pixels). Passed to the shader as a uniform. */
export const MID_PRICE_MIN_WIDTH_PX = 10;

/** Maximum drawn line width (device pixels). Passed to the shader as a uniform. */
export const MID_PRICE_MAX_WIDTH_PX = 10;

/**
 * Scalar used inside the shader to grow the line width with the
 * relative price change between two adjacent samples. The shader
 * computes
 *
 *     width = clamp(minWidthPx × |Δprice / price| × WIDTH_SCALE,
 *                   minWidthPx, maxWidthPx)
 *
 * so that `|Δprice / price| = 1 / (WIDTH_SCALE × maxWidth/minWidth)`
 * saturates to `maxWidthPx`. At the default values this is 1/150000 ≈
 * 0.00067 %, which roughly matches the per-second volatility of
 * BTCUSDT during calm trading; tune via this constant rather than
 * rewriting the formula.
 */
export const MID_PRICE_WIDTH_SCALE = 40_000;

/**
 * Relative price changes (`|Δprice / price|`) with absolute value
 * below this threshold are treated as "flat" — the segment is
 * painted with the neutral grey colour rather than green / red. Set
 * very low (one millionth of the price) so only genuinely unchanged
 * samples fall into the flat bucket; any meaningful movement gets a
 * directional colour.
 */
export const MID_PRICE_FLAT_RATIO_EPSILON = 1e-6;

/** Rising-price segment color (RGBA 0..1). */
export const MID_PRICE_COLOR_UP: readonly [number, number, number, number] = [0.08, 0.5, 0.18, 1.0];

/** Falling-price segment color. */
export const MID_PRICE_COLOR_DOWN: readonly [number, number, number, number] = [
  0.6, 0.12, 0.12, 1.0,
];

/** Flat-price segment color (neutral grey). */
export const MID_PRICE_COLOR_FLAT: readonly [number, number, number, number] = [0.0, 0.0, 0.0, 1.0];

/**
 * Vertices emitted per line segment instance (6 body + 6 join at sample B).
 *
 * We intentionally skip a cap at sample A: adjacent segments share
 * sample A as the previous segment's sample B, so the previous
 * segment's join-B already covers the junction. Drawing a second cap
 * here in the current segment's instance would paint the current
 * segment's black outline on top of the previous segment's body. The
 * very first sample in the chart is therefore rendered with a flat
 * end — acceptable cosmetic trade-off for correct junction stitching.
 */
export const MID_PRICE_VERTICES_PER_INSTANCE = 12;

/**
 * Black outline width on each side of the mid-price line, in device
 * pixels. The geometry is expanded by `2 × MID_PRICE_OUTLINE_WIDTH_PX`
 * (one on each side) and the fragment shader fills the outer band with
 * black — separating the line visually from the heatmap underneath.
 */
export const MID_PRICE_OUTLINE_WIDTH_PX = 4;

/** Crosshair line color — semi-transparent white, dashed. */
export const CROSSHAIR_LINE_COLOR = 'rgba(230, 230, 230, 0.7)';

/** Dash pattern (px) for the crosshair lines. */
export const CROSSHAIR_LINE_DASH: readonly [number, number] = [4, 4];

/** Background fill for the crosshair time / price labels. */
export const CROSSHAIR_LABEL_BG_COLOR = '#404a63';

/** Text color for the crosshair time / price labels. */
export const CROSSHAIR_LABEL_FG_COLOR = '#ffffff';
