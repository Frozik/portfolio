import { ScalingMode } from './trades-types';

/**
 * Constants for the trades layer. Grouped by purpose; values are fixed
 * at compile-time and shared between domain/application/presentation.
 */

// — Texture geometry —

/**
 * Width of the trades data-texture in texels. Equals the per-block
 * bucket cap, so one row of the texture holds exactly one block.
 */
export const TEXTURE_WIDTH_TEXELS = 256;

/** Floats per bucket inside the data-texture (rgba32float). */
export const FLOATS_PER_BUCKET = 4;

/** Per-block bucket cap; once reached the block is rotated. */
export const MAX_BUCKETS_PER_BLOCK = TEXTURE_WIDTH_TEXELS;

/** Hard cap on trade-blocks held in GPU + RAM (LRU-evicted past it). */
export const MAX_TRADE_BLOCKS_IN_RAM = 32;

/**
 * Hard cap on raw-trade payloads kept in RAM for the popup. Older
 * buckets fall through to IDB lazy-load.
 */
export const MAX_RAW_TRADES_BLOCKS_IN_RAM = 8;

/**
 * Soft cap on the number of raw trades retained for the live (open)
 * bucket. Above this count the accumulator drops the oldest entries to
 * keep the popup snappy on heavy bursts.
 */
export const ACTIVE_BUCKET_RAW_TRADES_SOFT_CAP = 2000;

// — Stroke (cyan, fixed) —

/** Outer stroke width in device pixels (constant, not adaptive). */
export const OUTLINE_PX = 2;

/** Antialias band width in device pixels for the smoothstep falloff. */
export const AA_WIDTH_PX = 1.0;

// — Visual radius envelope —

/**
 * Floor on the per-bucket visual radius — exactly one price-tick height
 * in device pixels. Shared between the renderer (per-frame radius
 * mapping in `TradesLayerRenderer.computeFrameState`) and the hit-test
 * resolver (`TradesStreamStore.findBucketAt`) so the click envelope
 * matches the rendered envelope on every zoom level — particularly in
 * `Log` mode where the diverging multipliers used to produce ghost
 * misses on small buckets.
 */
export const RADIUS_MIN_PRICE_TICK_MULT = 0.5;

/** Cap on the per-bucket visual radius — three price-tick heights in device pixels. */
export const RADIUS_MAX_PRICE_TICK_MULT = 1.5;

// — Hit-test —

/**
 * Hit-zone radius envelope. Hover/click MUST cover the entire visual
 * circle including the auto-scaled (volume-driven) enlargement — a
 * whale-bucket rendered as a 60-px circle should be clickable from
 * anywhere within those 60 px, not artificially shrunk by an upper
 * cap. Final formula:
 *
 *   `hitRadiusPx = max(visualRadiusPx + HIT_AREA_RADIUS_PADDING_PX, HIT_AREA_RADIUS_MIN_PX)`
 *
 * - The padding is a small grace margin so the cursor can sit just
 *   outside the rendered edge and still register.
 * - The floor keeps tiny visual circles tappable on touch.
 * - There is **no upper cap** — the visual envelope is always honoured.
 *   The "whale eats neighbours" trade-off described in earlier plan
 *   revisions is accepted: when a circle is genuinely bigger than its
 *   neighbours, it should win the hit-test in proportion to its
 *   visual footprint.
 */
export const HIT_AREA_RADIUS_PADDING_PX = 8;

/** Floor on the hit-zone radius — comfortable for fingertip taps. */
export const HIT_AREA_RADIUS_MIN_PX = 12;

/**
 * Horizontal pointer travel (CSS px) below this threshold is treated as
 * a click rather than a drag for `pointerType === 'mouse' | 'pen'`.
 * The viewport only pans along X, so vertical motion is intentionally
 * ignored — matches the input controller's pan-distance accumulator.
 */
export const MIN_DRAG_DISTANCE_PX_MOUSE = 2;

/**
 * Same horizontal threshold for `pointerType === 'touch'` — fingers
 * wobble more, especially when reaching the top / bottom of a tall
 * portrait canvas. Y wobble must not kill the tap because the chart
 * never pans vertically.
 */
export const MIN_DRAG_DISTANCE_PX_TOUCH = 8;

/**
 * Time tolerance (ms) when matching a pointer to nearby buckets along
 * the X axis.
 */
export const HIT_TOLERANCE_MS = 2000;

// — Hover —

/** Scale factor applied to the hovered bucket's circle. */
export const HOVER_SCALE_FACTOR = 1.5;

/** Hover-enter transition duration in ms (cubic-out). */
export const HOVER_ENTER_MS = 120;

/** Hover-leave transition duration in ms (cubic-in). */
export const HOVER_LEAVE_MS = 220;

/**
 * Intent delay before the hover-enter transition (and the preview pill)
 * actually start. Keeps fast-moving cursors from triggering a stream of
 * spurious hovers.
 */
export const HOVER_ENTER_DELAY_MS = 80;

/** Pointer movement below this distance does not retrigger hover hit-test. */
export const HOVER_DEAD_ZONE_PX = 2;

// — Colors as hex strings (linearised at pipeline-creation via hexToLinearRgb) —

/** Buy (taker) fill colour — CSS hex, sRGB. 20% darker than the original `#34C759`. */
export const COLOR_BUY = '#34C759';

/** Sell (taker) fill colour — CSS hex, sRGB. 20% darker than the original `#FF3B30`. */
export const COLOR_SELL = '#FF3B30';

/** Outer stroke colour — CSS hex, sRGB. */
export const COLOR_OUTLINE = '#000000';

// — Fill opacity (size-driven) —

/**
 * Fill alpha applied to the smallest circles (visual radius at the
 * `RADIUS_MIN_PRICE_TICK_MULT` floor). Larger circles fade towards
 * {@link FILL_OPACITY_AT_MAX_RADIUS} so heavy-volume bursts don't
 * mask the heatmap underneath.
 */
export const FILL_OPACITY_AT_MIN_RADIUS = 0.7;

/**
 * Fill alpha applied to the largest circles (visual radius at the
 * `RADIUS_MAX_PRICE_TICK_MULT` cap). Lower than
 * {@link FILL_OPACITY_AT_MIN_RADIUS} — bigger means more transparent
 * so the orderbook heatmap stays readable beneath whale-buckets.
 */
export const FILL_OPACITY_AT_MAX_RADIUS = 0.6;

// — Dev-time scaling-mode toggle —

/**
 * Active volume → radius scaling mode. Edited by the developer when
 * comparing modes; not exposed in the UI. `Log` is the production
 * default — preserves dynamic range without losing the small buckets.
 */
export const DEFAULT_SCALING_MODE: ScalingMode = ScalingMode.Log;
