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

/**
 * How long past a bucket's end the quantizer waits for a late update before
 * closing the bucket by wall clock. Binance stamps `@depth@1000ms` updates
 * ~0.8 s into each second and they reach the browser 0.1–0.7 s later, so a
 * zero-grace deadline dropped a noticeable share of real updates as stale.
 */
export const QUANTIZER_LATE_ARRIVAL_GRACE_MS = 1500;

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

/** Candles per block: 256 one-second candles ≈ 4 min 16 s, two texels each. */
export const CANDLES_PER_BLOCK = 256;

/** Rolling-window cap of candle blocks kept in the index and IndexedDB (≈ 68 min). */
export const MAX_CANDLE_HISTORY_BLOCKS = 16;

/** Candle data-texture width in texels; one block is `CANDLES_PER_BLOCK × 2` texels wide. */
export const CANDLE_TEXTURE_WIDTH = 2048;

/** Rows of the candle GPU texture; 2 rows × 4 slots = 8 resident blocks, older ones reload from IndexedDB. */
export const CANDLE_TEXTURE_ROWS = 2;

/** Simple moving average windows, in candles (seconds). */
export const MOVING_AVERAGE_SHORT_PERIOD = 5;
export const MOVING_AVERAGE_LONG_PERIOD = 10;

/** Band under the price area: volume bars on top, time-axis labels along the bottom. CSS pixels. */
export const VOLUME_PANEL_CSS_PX = 96;
const TIME_AXIS_LABELS_CSS_PX = 24;
export const VOLUME_BARS_CSS_PX = VOLUME_PANEL_CSS_PX - TIME_AXIS_LABELS_CSS_PX;
/** Volume bar width as a fraction of the one-second slot. */
export const VOLUME_BAR_WIDTH_RATIO = 0.8;
/** Heatmap alpha while candles are drawn over it, so the candles stay readable. */
export const HEATMAP_ALPHA_UNDER_CANDLES = 0.55;

/** Candle body width as a fraction of the one-second slot. */
export const CANDLE_BODY_WIDTH_RATIO = 0.7;
/** Wick and body outline thickness in CSS pixels. */
export const CANDLE_WICK_WIDTH_PX = 1.5;
/** Floor on the body height so a flat candle is still visible. */
export const CANDLE_MIN_BODY_HEIGHT_PX = 1.5;
/** Moving-average line thickness in CSS pixels. */
export const MOVING_AVERAGE_LINE_WIDTH_PX = 2;

export const CANDLE_COLOR_UP = '#2ea043';
export const CANDLE_COLOR_DOWN = '#e53935';
export const CANDLE_COLOR_OUTLINE = '#0b0d10';
export const MOVING_AVERAGE_SHORT_COLOR = '#f5c518';
export const MOVING_AVERAGE_LONG_COLOR = '#4fc3f7';

/** Crosshair line color — semi-transparent white, dashed. */
export const CROSSHAIR_LINE_COLOR = 'rgba(230, 230, 230, 0.7)';

/** Dash pattern (px) for the crosshair lines. */
export const CROSSHAIR_LINE_DASH: readonly [number, number] = [4, 4];

/** Background fill for the crosshair time / price labels. */
export const CROSSHAIR_LABEL_BG_COLOR = '#404a63';

/** Text color for the crosshair time / price labels. */
export const CROSSHAIR_LABEL_FG_COLOR = '#ffffff';
