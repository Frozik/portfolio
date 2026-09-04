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

/** Length of one trade bucket: trades are aggregated per second. */
export const BUCKET_DURATION_MS = 1000;

/** Pointer movement below this distance does not retrigger hover hit-test. */
export const HOVER_DEAD_ZONE_PX = 2;

// — Colors as hex strings (linearised at pipeline-creation via hexToLinearRgb) —

/** Buy (taker) fill colour — CSS hex, sRGB. 20% darker than the original `#34C759`. */
export const COLOR_BUY = '#34C759';

/** Sell (taker) fill colour — CSS hex, sRGB. 20% darker than the original `#FF3B30`. */
export const COLOR_SELL = '#FF3B30';

/** How far the hovered volume bar is pushed towards white. */
export const VOLUME_BAR_HOVER_MIX = 0.35;
