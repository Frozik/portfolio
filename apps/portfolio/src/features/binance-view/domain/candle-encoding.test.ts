import { describe, expect, it } from 'vitest';

import { decodeCandle, encodeCandle, FLOATS_PER_CANDLE } from './candle-encoding';
import type { ICandle } from './candle-types';
import type { UnixTimeMs } from './types';

const META = { firstBucketStartMs: 1_700_000_000_000 as UnixTimeMs, basePrice: 100 };

const CANDLE: ICandle = {
  bucketStartMs: (META.firstBucketStartMs + 3000) as UnixTimeMs,
  open: 101,
  high: 103.5,
  low: 99.25,
  close: 102,
  movingAverage5: 101.5,
  movingAverage10: 100.75,
};

describe('candle encoding', () => {
  it('round-trips a candle through the two-texel layout at its index', () => {
    const data = new Float32Array(FLOATS_PER_CANDLE * 3);
    encodeCandle(CANDLE, META, data, 2);

    expect(decodeCandle(data, META, 2)).toEqual(CANDLE);
    expect(data[2 * FLOATS_PER_CANDLE]).toBe(3000);
    expect(data[2 * FLOATS_PER_CANDLE + 7]).toBe(0);
  });
});
