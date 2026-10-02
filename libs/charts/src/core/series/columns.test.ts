import { describe, expect, it } from 'vitest';

import { columnsOf } from './columns';

describe('columnsOf', () => {
  it('turns points given as objects into columns, time into 64-bit integers', () => {
    const columns = columnsOf({
      shape: 'point',
      points: [
        { x: 1_000_000_000_000_000_001n, value: 1.5 },
        { x: 1_000_000_000_000_000_002n, value: Number.NaN },
      ],
    });

    expect(columns.shape).toBe('point');
    expect(columns.x).toBeInstanceOf(BigInt64Array);
    expect(Array.from(columns.x as BigInt64Array)).toEqual([
      1_000_000_000_000_000_001n,
      1_000_000_000_000_000_002n,
    ]);
    expect(columns.shape === 'point' && Number.isNaN(columns.value[1])).toBe(true);
  });

  it('keeps a numeric axis as numbers', () => {
    const columns = columnsOf({ shape: 'point', points: [{ x: 0.5, value: 2 }] });

    expect(columns.x).toBeInstanceOf(Float64Array);
    expect(columns.length).toBe(1);
  });

  it('takes columns as they are, without copying', () => {
    const x = new BigInt64Array([1n, 2n]);
    const value = new Float64Array([10, 20]);

    const columns = columnsOf({ shape: 'point', points: { x, value } });

    expect(columns.x).toBe(x);
    expect(columns.shape === 'point' && columns.value).toBe(value);
  });

  it('spreads candles into four value columns', () => {
    const columns = columnsOf({
      shape: 'candle',
      candles: [{ x: 60n, open: 1, min: 0.5, max: 2, close: 1.5 }],
    });

    expect(columns).toMatchObject({ shape: 'candle', length: 1 });
    if (columns.shape === 'candle') {
      expect([columns.open[0], columns.min[0], columns.max[0], columns.close[0]]).toEqual([
        1, 0.5, 2, 1.5,
      ]);
    }
  });

  it('accepts an empty answer', () => {
    expect(columnsOf({ shape: 'point', points: [] }).length).toBe(0);
  });
});
