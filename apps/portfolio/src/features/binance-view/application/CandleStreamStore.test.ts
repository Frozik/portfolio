import { describe, expect, it } from 'vitest';

import type { IBinanceDb } from '../domain/binance-db';
import { createCandleBlockIndex } from '../domain/block-store/create-candle-block-index';
import { encodeCandle, FLOATS_PER_CANDLE } from '../domain/candle-encoding';
import type { ICandleBlockRecord, IOhlcBucket } from '../domain/candle-types';
import type { ICandleFlushEvent } from '../domain/flush-events';
import type { UnixTimeMs } from '../domain/types';
import { CandleStreamStore } from './CandleStreamStore';
import type { BinanceChartState } from './chart-state';
import { PersistenceGate } from './persistence-gate';

const FIRST_SECOND_MS = 1_700_000_000_000 as UnixTimeMs;
const SECOND_MS = 1000;

/** Mirrors what the candle layer does with a flush: the index entry follows the block. */
function createFakeChartState(): Pick<
  BinanceChartState,
  'candleIndex' | 'ingestCandleFlush' | 'restoreCandleBlock' | 'releaseCandleBlockSlot'
> {
  const candleIndex = createCandleBlockIndex();
  const upsert = (meta: ICandleFlushEvent['block'] | ICandleBlockRecord): void => {
    candleIndex.upsert({
      minX: meta.firstBucketStartMs,
      maxX: meta.lastBucketStartMs,
      minY: 0,
      maxY: 0,
      blockId: meta.blockId,
      textureRowIndex: 0,
      firstBucketStartMs: meta.firstBucketStartMs,
      lastBucketStartMs: meta.lastBucketStartMs,
      basePrice: meta.basePrice,
      count: meta.count,
    });
  };
  return {
    candleIndex,
    ingestCandleFlush: event => upsert(event.block),
    restoreCandleBlock: record => upsert(record),
    releaseCandleBlockSlot: () => {},
  };
}

function bucketAt(offsetSeconds: number, close: number): IOhlcBucket {
  return {
    bucketStartMs: (FIRST_SECOND_MS + offsetSeconds * SECOND_MS) as UnixTimeMs,
    open: 100,
    high: Math.max(100, close),
    low: Math.min(100, close),
    close,
  };
}

/** A database holding one persisted candle block, for the reload path. */
function createFakeDb(record: ICandleBlockRecord): IBinanceDb {
  const untouched = {
    clearAll: async () => undefined,
    putBlock: async () => undefined,
    getBlock: async () => undefined,
    deleteBlock: async () => undefined,
    countBlocks: async () => 0,
  };
  return {
    orderbook: { ...untouched, close: () => undefined },
    candles: { ...untouched, getBlock: async () => record },
    trades: {
      ...untouched,
      putRawTrades: async () => undefined,
      getRawTrades: async () => undefined,
      deleteRawTrades: async () => undefined,
    },
    clearAll: async () => undefined,
    close: () => undefined,
  };
}

function createStore(db?: IBinanceDb) {
  const chartState = createFakeChartState();
  const store = new CandleStreamStore({
    chartState: chartState as BinanceChartState,
    persistence: new PersistenceGate(db, () => {}),
  });
  store.startStream();
  return { store, chartState };
}

const pointerAt = (worldTimeMs: number) => ({
  worldTimeMs: worldTimeMs as UnixTimeMs,
  pointerPx: { x: 0, y: 0 },
});

describe('CandleStreamStore hover', () => {
  it('resolves the candle under the pointer from the flushed block', () => {
    const { store } = createStore();
    store.ingestClosedBucket(bucketAt(0, 101));
    store.ingestClosedBucket(bucketAt(1, 99));

    store.setHoveredCandleAt(pointerAt(FIRST_SECOND_MS + SECOND_MS + 400));

    expect(store.hoveredCandleKey).toBe(FIRST_SECOND_MS + SECOND_MS);
    expect(store.hoveredCandle?.close).toBe(99);
  });

  it('ends the hover when the pointer leaves the price area', () => {
    const { store } = createStore();
    store.ingestClosedBucket(bucketAt(0, 101));
    store.setHoveredCandleAt(pointerAt(FIRST_SECOND_MS));

    store.setHoveredCandleAt(undefined);

    expect(store.hoveredCandleKey).toBeUndefined();
    expect(store.hoveredCandle).toBeUndefined();
  });

  it('serves a reloaded block to the hover as well', async () => {
    const data = new Float32Array(FLOATS_PER_CANDLE);
    encodeCandle(
      { ...bucketAt(0, 101), movingAverage5: 100, movingAverage10: 100 },
      { firstBucketStartMs: FIRST_SECOND_MS, basePrice: 100 },
      data,
      0
    );
    const { store } = createStore(
      createFakeDb({
        blockId: FIRST_SECOND_MS,
        firstBucketStartMs: FIRST_SECOND_MS,
        lastBucketStartMs: FIRST_SECOND_MS,
        basePrice: 100,
        count: 1,
        data: data.buffer,
      })
    );

    store.requestBlocks([FIRST_SECOND_MS]);
    await new Promise(resolve => setTimeout(resolve, 0));
    store.setHoveredCandleAt(pointerAt(FIRST_SECOND_MS + 10));

    expect(store.hoveredCandle?.close).toBe(101);
  });

  it('forgets the hover and the block data on dispose', () => {
    const { store } = createStore();
    store.ingestClosedBucket(bucketAt(0, 101));
    store.setHoveredCandleAt(pointerAt(FIRST_SECOND_MS));

    store.dispose();

    expect(store.hoveredCandleKey).toBeUndefined();
  });
});
