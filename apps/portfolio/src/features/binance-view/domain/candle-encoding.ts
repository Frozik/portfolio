import type { ICandle, ICandleBlockMeta } from './candle-types';
import type { UnixTimeMs } from './types';

/**
 * A candle occupies two `rgba32float` texels:
 *   texel 0 — `(timeDeltaMs, open − base, high − base, low − base)`
 *   texel 1 — `(close − base, ma5 − base, ma10 − base, 0)`
 * Time is relative to the block's first bucket, prices to its `basePrice`.
 */
export const TEXELS_PER_CANDLE = 2;
const FLOATS_PER_TEXEL = 4;
export const FLOATS_PER_CANDLE = TEXELS_PER_CANDLE * FLOATS_PER_TEXEL;

export function encodeCandle(
  candle: ICandle,
  meta: Pick<ICandleBlockMeta, 'firstBucketStartMs' | 'basePrice'>,
  target: Float32Array,
  candleIndex: number
): void {
  const offset = candleIndex * FLOATS_PER_CANDLE;
  target[offset] = candle.bucketStartMs - meta.firstBucketStartMs;
  target[offset + 1] = candle.open - meta.basePrice;
  target[offset + 2] = candle.high - meta.basePrice;
  target[offset + 3] = candle.low - meta.basePrice;
  target[offset + 4] = candle.close - meta.basePrice;
  target[offset + 5] = candle.movingAverage5 - meta.basePrice;
  target[offset + 6] = candle.movingAverage10 - meta.basePrice;
  target[offset + 7] = 0;
}

export function decodeCandle(
  data: Float32Array,
  meta: Pick<ICandleBlockMeta, 'firstBucketStartMs' | 'basePrice'>,
  candleIndex: number
): ICandle {
  const offset = candleIndex * FLOATS_PER_CANDLE;
  return {
    bucketStartMs: (meta.firstBucketStartMs + data[offset]) as UnixTimeMs,
    open: meta.basePrice + data[offset + 1],
    high: meta.basePrice + data[offset + 2],
    low: meta.basePrice + data[offset + 3],
    close: meta.basePrice + data[offset + 4],
    movingAverage5: meta.basePrice + data[offset + 5],
    movingAverage10: meta.basePrice + data[offset + 6],
  };
}
