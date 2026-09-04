import { describe, expect, it } from 'vitest';

import { decodeCandle } from '../domain/candle-encoding';
import type { ICandle } from '../domain/candle-types';
import type { ICandleFlushEvent } from '../domain/flush-events';
import type { UnixTimeMs } from '../domain/types';

import { CandleBlockAccumulator } from './candle-block-accumulator';

const T0 = 1_700_000_000_000 as UnixTimeMs;
const SECOND_MS = 1000;

function candle(secondIndex: number, close: number): ICandle {
  return {
    bucketStartMs: (T0 + secondIndex * SECOND_MS) as UnixTimeMs,
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close,
    movingAverage5: close,
    movingAverage10: close,
  };
}

function createAccumulator(candlesPerBlock: number) {
  const flushes: ICandleFlushEvent[] = [];
  const accumulator = new CandleBlockAccumulator({
    candlesPerBlock,
    onFlush: event => flushes.push(event),
  });
  return { accumulator, flushes };
}

describe('CandleBlockAccumulator', () => {
  it('flushes every candle, keyed on the first candle and based on its open', () => {
    const { accumulator, flushes } = createAccumulator(4);
    accumulator.addCandle(candle(0, 100));
    accumulator.addCandle(candle(1, 105));

    expect(flushes).toHaveLength(2);
    expect(flushes[0]?.isNewBlock).toBe(true);
    expect(flushes[1]?.isNewBlock).toBe(false);
    expect(flushes[1]?.block).toMatchObject({
      blockId: T0,
      basePrice: 99,
      count: 2,
      lastBucketStartMs: T0 + SECOND_MS,
    });
    const second = flushes[1];
    expect(second === undefined ? undefined : decodeCandle(second.data, second.block, 1)).toEqual(
      candle(1, 105)
    );
  });

  it('rotates into a fresh block once the block is full', () => {
    const { accumulator, flushes } = createAccumulator(2);
    accumulator.addCandle(candle(0, 100));
    accumulator.addCandle(candle(1, 101));
    accumulator.addCandle(candle(2, 102));

    expect(flushes[2]?.isNewBlock).toBe(true);
    expect(flushes[2]?.block.blockId).toBe(T0 + 2 * SECOND_MS);
    expect(flushes[2]?.block.count).toBe(1);
  });
});
