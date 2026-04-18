import { describe, expect, test } from 'vitest';

import { getMidPrice } from './get-mid-price';
import type { IOrderbookSnapshot, UnixTimeMs } from './types';

function snapshot(partial: {
  bids?: ReadonlyArray<readonly [number, number]>;
  asks?: ReadonlyArray<readonly [number, number]>;
}): IOrderbookSnapshot {
  return {
    eventTimeMs: 0 as UnixTimeMs,
    bids: partial.bids ?? [],
    asks: partial.asks ?? [],
  };
}

describe('getMidPrice', () => {
  test('averages best bid and best ask when both present', () => {
    const result = getMidPrice(
      snapshot({
        bids: [
          [100, 1],
          [99, 2],
        ],
        asks: [
          [101, 1],
          [102, 3],
        ],
      })
    );
    expect(result).toBe(100.5);
  });

  test('returns best bid when asks are empty', () => {
    expect(getMidPrice(snapshot({ bids: [[100, 1]] }))).toBe(100);
  });

  test('returns best ask when bids are empty', () => {
    expect(getMidPrice(snapshot({ asks: [[101, 1]] }))).toBe(101);
  });

  test('returns fallback when both sides empty', () => {
    expect(getMidPrice(snapshot({}), 99)).toBe(99);
  });

  test('returns undefined when both sides empty and no fallback', () => {
    expect(getMidPrice(snapshot({}))).toBeUndefined();
  });
});
