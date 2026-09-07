import { describe, expect, it } from 'vitest';

import { candleChangeBps, candleRangeBps } from './candle-stats';
import type { UnixTimeMs } from './types';

const CANDLE = {
  bucketStartMs: 0 as UnixTimeMs,
  open: 50_000,
  high: 50_030,
  low: 49_990,
  close: 50_010,
};

describe('candle stats', () => {
  it('measures the change from open to close in basis points', () => {
    expect(candleChangeBps(CANDLE)).toBeCloseTo(2);
    expect(candleChangeBps({ ...CANDLE, close: 49_975 })).toBeCloseTo(-5);
  });

  it('measures the high-low range in basis points of the open', () => {
    expect(candleRangeBps(CANDLE)).toBeCloseTo(8);
  });
});
