import type { IOhlcBucket } from './candle-types';

const BPS_PER_UNIT = 10_000;

/** Close against open, in basis points of the open. */
export function candleChangeBps(candle: IOhlcBucket): number {
  return ((candle.close - candle.open) / candle.open) * BPS_PER_UNIT;
}

/** High against low, in basis points of the open. */
export function candleRangeBps(candle: IOhlcBucket): number {
  return ((candle.high - candle.low) / candle.open) * BPS_PER_UNIT;
}
