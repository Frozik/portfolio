import { describe, expect, test } from 'vitest';

import { FLOATS_PER_TEXEL, SNAPSHOT_SLOTS, TEXEL_INTERP_CHANNEL } from '../domain/constants';
import type { IOrderbookSnapshot, UnixTimeMs } from '../domain/types';
import { levelSide, snapshotToLevels } from './snapshot-to-levels';

const DEPTH = 50;

function makeSnapshot(partial: {
  bids?: ReadonlyArray<readonly [number, number]>;
  asks?: ReadonlyArray<readonly [number, number]>;
}): IOrderbookSnapshot {
  return {
    eventTimeMs: 0 as UnixTimeMs,
    bids: partial.bids ?? [],
    asks: partial.asks ?? [],
  };
}

describe('snapshotToLevels', () => {
  test('returns Float32Array of length snapshotSlots × 4', () => {
    const result = snapshotToLevels(makeSnapshot({}), SNAPSHOT_SLOTS, DEPTH, false);
    expect(result.length).toBe(SNAPSHOT_SLOTS * FLOATS_PER_TEXEL);
  });

  test('places bids at [0 .. depth) in order, layout [0, price, volume, 0]', () => {
    const snapshot = makeSnapshot({
      bids: [
        [100, 1.5],
        [99, 2.0],
        [98, 0.5],
      ],
    });
    const result = snapshotToLevels(snapshot, SNAPSHOT_SLOTS, DEPTH, false);

    expect(result[0]).toBe(0); // timeDelta written by accumulator
    expect(result[1]).toBe(100);
    expect(result[2]).toBe(1.5);
    expect(result[3]).toBe(0);

    expect(result[4]).toBe(0);
    expect(result[5]).toBe(99);
    expect(result[6]).toBe(2.0);

    expect(result[9]).toBe(98);
    expect(result[10]).toBe(0.5);
  });

  test('places asks at [depth .. 2*depth)', () => {
    const snapshot = makeSnapshot({
      asks: [
        [101, 1.0],
        [102, 3.0],
      ],
    });
    const result = snapshotToLevels(snapshot, SNAPSHOT_SLOTS, DEPTH, false);

    const askBase = DEPTH * FLOATS_PER_TEXEL;
    expect(result[askBase + 1]).toBe(101);
    expect(result[askBase + 2]).toBe(1.0);

    expect(result[askBase + 5]).toBe(102);
    expect(result[askBase + 6]).toBe(3.0);
  });

  test('padding tail is zero when fewer than depth levels on either side', () => {
    const snapshot = makeSnapshot({
      bids: [[100, 1]],
      asks: [[101, 1]],
    });
    const result = snapshotToLevels(snapshot, SNAPSHOT_SLOTS, DEPTH, false);

    // Second bid slot (index 1 within bids, offset 4) should be zero
    expect(result[4 + 1]).toBe(0); // price
    expect(result[4 + 2]).toBe(0); // volume

    // Second ask slot (offset (depth+1)*4)
    const secondAskOffset = (DEPTH + 1) * FLOATS_PER_TEXEL;
    expect(result[secondAskOffset + 1]).toBe(0);
    expect(result[secondAskOffset + 2]).toBe(0);

    // Trailing padding (last texel) is zero
    const lastOffset = (SNAPSHOT_SLOTS - 1) * FLOATS_PER_TEXEL;
    expect(result[lastOffset + 2]).toBe(0);
  });

  test('excess bids / asks beyond depth are truncated', () => {
    const manyBids = Array.from({ length: DEPTH + 10 }, (_, index) => [100 - index, 1] as const);
    const snapshot = makeSnapshot({ bids: manyBids });
    const result = snapshotToLevels(snapshot, SNAPSHOT_SLOTS, DEPTH, false);

    // DEPTH-th bid would be at offset DEPTH*4; must be zero (truncated).
    const askBase = DEPTH * FLOATS_PER_TEXEL;
    expect(result[askBase + 1]).toBe(0);
    expect(result[askBase + 2]).toBe(0);
  });

  test('writes isInterpolated=1 into the 4th channel of every filled texel', () => {
    const snapshot = makeSnapshot({
      bids: [
        [100, 1],
        [99, 2],
      ],
      asks: [[101, 3]],
    });
    const result = snapshotToLevels(snapshot, SNAPSHOT_SLOTS, DEPTH, true);

    expect(result[TEXEL_INTERP_CHANNEL]).toBe(1);
    expect(result[FLOATS_PER_TEXEL + TEXEL_INTERP_CHANNEL]).toBe(1);

    const askOffset = DEPTH * FLOATS_PER_TEXEL;
    expect(result[askOffset + TEXEL_INTERP_CHANNEL]).toBe(1);

    // Padding cells should remain zero (no volume → skipped in shader anyway)
    const padOffset = (DEPTH + 1) * FLOATS_PER_TEXEL;
    expect(result[padOffset + TEXEL_INTERP_CHANNEL]).toBe(0);
  });

  test('isInterpolated=false writes 0 into the flag channel', () => {
    const snapshot = makeSnapshot({ bids: [[100, 1]] });
    const result = snapshotToLevels(snapshot, SNAPSHOT_SLOTS, DEPTH, false);
    expect(result[TEXEL_INTERP_CHANNEL]).toBe(0);
  });
});

describe('levelSide', () => {
  test('returns bid for indices [0 .. depth)', () => {
    expect(levelSide(0, DEPTH)).toBe('bid');
    expect(levelSide(DEPTH - 1, DEPTH)).toBe('bid');
  });

  test('returns ask for indices [depth .. 2*depth)', () => {
    expect(levelSide(DEPTH, DEPTH)).toBe('ask');
    expect(levelSide(2 * DEPTH - 1, DEPTH)).toBe('ask');
  });

  test('returns padding beyond 2*depth', () => {
    expect(levelSide(2 * DEPTH, DEPTH)).toBe('padding');
    expect(levelSide(127, DEPTH)).toBe('padding');
  });
});
