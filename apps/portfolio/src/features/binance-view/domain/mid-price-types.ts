import type { UnixTimeMs } from './types';

/**
 * One point on the mid-price time series, as received from the
 * Binance `<symbol>@midPrice` WebSocket stream (after mapping).
 *
 * `eventTimeMs` is the time Binance emitted the event (field `E` in
 * the raw payload); `price` is the weighted average price (field `w`).
 * No aggregation or interpolation happens at this layer — the
 * accumulator handles both.
 */
export interface IMidPriceSample {
  readonly eventTimeMs: UnixTimeMs;
  readonly price: number;
}

/**
 * Metadata for a fixed-size block of mid-price samples. Mirrors
 * the orderbook `IBlockMeta` shape but parameterised for the line
 * layer's own texture / block-size.
 *
 * `basePrice` is the price of the block's first real sample — every
 * texel's Y channel stores `sample.price - basePrice`, keeping the
 * values inside the f32-safe range even at high absolute prices.
 */
export interface IMidPriceBlockMeta {
  readonly blockId: UnixTimeMs;
  readonly firstTimestampMs: UnixTimeMs;
  readonly basePrice: number;
  lastTimestampMs: UnixTimeMs;
  count: number;
  textureRowIndex: number | undefined;
}

/**
 * Entry stored in the in-memory block index. Flat / time-only —
 * mid-price is 1-D so RBush would be over-engineering.
 */
export interface IMidPriceBlockIndexItem {
  readonly blockId: UnixTimeMs;
  readonly firstTimestampMs: UnixTimeMs;
  readonly basePrice: number;
  lastTimestampMs: UnixTimeMs;
  count: number;
  textureRowIndex: number | undefined;
}

/**
 * Discrete direction of movement between two adjacent samples. The
 * renderer picks a color per segment based on this tag rather than
 * interpolating between continuous signed slopes — the visual is
 * easier to read and tiny FP noise near zero won't flicker the line
 * between green and red.
 */
export type MidPriceDirection = 'up' | 'down' | 'flat';
