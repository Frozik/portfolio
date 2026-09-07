import { describe, expect, it } from 'vitest';

import { BlockSpatialIndex } from './block-store/block-spatial-index';
import { encodeCandle, FLOATS_PER_CANDLE } from './candle-encoding';
import { decodeCandleAt, findCandleAt } from './candle-hit-test';
import type { ICandle, ICandleBlockIndexItem } from './candle-types';
import type { UnixTimeMs } from './types';

const BLOCK_START_MS = 1_700_000_000_000 as UnixTimeMs;
const SECOND_MS = 1000;
const BASE_PRICE = 60_000;

function candleAt(offsetSeconds: number): ICandle {
  return {
    bucketStartMs: (BLOCK_START_MS + offsetSeconds * SECOND_MS) as UnixTimeMs,
    open: BASE_PRICE + offsetSeconds,
    high: BASE_PRICE + offsetSeconds + 2,
    low: BASE_PRICE + offsetSeconds - 1,
    close: BASE_PRICE + offsetSeconds + 1,
    movingAverage5: BASE_PRICE,
    movingAverage10: BASE_PRICE,
  };
}

function buildIndex(candles: readonly ICandle[]) {
  const candleIndex = new BlockSpatialIndex<ICandleBlockIndexItem>();
  const meta = { firstBucketStartMs: BLOCK_START_MS, basePrice: BASE_PRICE };
  const data = new Float32Array(candles.length * FLOATS_PER_CANDLE);
  candles.forEach((candle, index) => encodeCandle(candle, meta, data, index));
  candleIndex.upsert({
    minX: BLOCK_START_MS,
    maxX: candles[candles.length - 1].bucketStartMs,
    minY: 0,
    maxY: 0,
    blockId: BLOCK_START_MS,
    textureRowIndex: 0,
    firstBucketStartMs: BLOCK_START_MS,
    lastBucketStartMs: candles[candles.length - 1].bucketStartMs,
    basePrice: BASE_PRICE,
    count: candles.length,
  });
  return { candleIndex, blockData: new Map([[BLOCK_START_MS, data]]) };
}

const pointerAt = (worldTimeMs: number) => ({
  worldTimeMs: worldTimeMs as UnixTimeMs,
  pointerPx: { x: 0, y: 0 },
});

describe('findCandleAt', () => {
  it('hits the candle anywhere inside its one-second slot', () => {
    const { candleIndex, blockData } = buildIndex([candleAt(0), candleAt(1), candleAt(2)]);

    const candle = findCandleAt(
      pointerAt(BLOCK_START_MS + SECOND_MS + 999),
      candleIndex,
      blockData
    );

    expect(candle?.bucketStartMs).toBe(BLOCK_START_MS + SECOND_MS);
    expect(candle?.close).toBe(BASE_PRICE + 2);
  });

  it('misses a second that has no candle and a block that left RAM', () => {
    const { candleIndex, blockData } = buildIndex([candleAt(0), candleAt(2)]);

    expect(
      findCandleAt(pointerAt(BLOCK_START_MS + SECOND_MS), candleIndex, blockData)
    ).toBeUndefined();
    expect(findCandleAt(pointerAt(BLOCK_START_MS), candleIndex, new Map())).toBeUndefined();
  });

  it('decodes the candle that starts exactly at a key', () => {
    const { candleIndex, blockData } = buildIndex([candleAt(0), candleAt(1)]);

    expect(
      decodeCandleAt((BLOCK_START_MS + SECOND_MS) as UnixTimeMs, candleIndex, blockData)?.open
    ).toBe(BASE_PRICE + 1);
  });
});
