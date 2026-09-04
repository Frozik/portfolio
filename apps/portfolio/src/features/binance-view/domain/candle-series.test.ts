import { describe, expect, it } from 'vitest';

import { CandleSeriesBuilder } from './candle-series';
import type { ICandle, IOhlcBucket } from './candle-types';
import type { UnixTimeMs } from './types';

const SECOND_MS = 1000;
const T0 = 1_700_000_000_000 as UnixTimeMs;

function bucket(secondIndex: number, close: number, spread = 1): IOhlcBucket {
  return {
    bucketStartMs: (T0 + secondIndex * SECOND_MS) as UnixTimeMs,
    open: close - spread,
    high: close + spread,
    low: close - 2 * spread,
    close,
  };
}

describe('CandleSeriesBuilder', () => {
  it('returns the bucket itself as a candle with partial-window averages at the start', () => {
    const builder = new CandleSeriesBuilder();

    const [first] = builder.append(bucket(0, 100));
    const [second] = builder.append(bucket(1, 104));

    expect(first?.movingAverage5).toBe(100);
    expect(second?.movingAverage5).toBe(102);
    expect(second?.movingAverage10).toBe(102);
  });

  it('fills seconds without trades with flat candles at the previous close', () => {
    const builder = new CandleSeriesBuilder();
    builder.append(bucket(0, 100));

    const candles = builder.append(bucket(3, 106));

    expect(candles.map(candle => candle.bucketStartMs - T0)).toEqual([1000, 2000, 3000]);
    expect(candles[0]).toMatchObject({ open: 100, high: 100, low: 100, close: 100 });
    expect(candles[2]?.close).toBe(106);
  });

  it('averages exactly the last 5 and 10 closes once the windows are full', () => {
    const builder = new CandleSeriesBuilder();
    let last: readonly ICandle[] = [];
    for (let secondIndex = 0; secondIndex < 12; secondIndex++) {
      last = builder.append(bucket(secondIndex, secondIndex + 1));
    }

    const candle = last[0];
    // closes 8..12 → 10; closes 3..12 → 7.5
    expect(candle?.movingAverage5).toBe(10);
    expect(candle?.movingAverage10).toBe(7.5);
  });
});
