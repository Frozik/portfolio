import 'fake-indexeddb/auto';

import { configure } from 'mobx';
import { Subject } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Importing the live `BinanceChartState` class is impossible in a
// happy-dom environment because its module dep chain transitively pulls
// in `binance-chart-renderer` → `texture-row-manager`, both of which
// reference `GPUTextureUsage` at module-load time and crash with
// `ReferenceError` outside a real browser. We therefore mock the entire
// chart-state module; the test substitutes a structural stub that
// satisfies just the surface the trades store touches (`tradesIndex`,
// `ingestTradesFlush`, `releaseTradesBlockSlot`,
// `getTradesLayerLastFrameStats`).
vi.mock('../domain/chart-state', () => {
  return {
    BinanceChartState: class {},
  };
});

vi.mock('../infrastructure/trades-stream', () => {
  return {
    liveTrades$: () => liveTradesSubject,
    mapRawAggTradeToITrade: vi.fn(),
  };
});

import { createTradesBlockIndex } from '../domain/block-store/create-trades-block-index';
import type { BinanceChartState } from '../domain/chart-state';
import { BINANCE_CONFIG } from '../domain/config';
import type { ITradeBlockFlushEventBridge } from '../domain/render-frame-types';
import { MAX_BUCKETS_PER_BLOCK } from '../domain/trades-constants';
import type {
  ITrade,
  ITradeBlockIndexItem,
  ITradeBlockRecord,
  ITradeBucketRawRecord,
  Quantity,
  TradeId,
} from '../domain/trades-types';
import type { UnixTimeMs } from '../domain/types';
import type { IBinanceDb } from '../infrastructure/binance-indexeddb';

import type { IOrderbookGate } from './IOrderbookGate';
import { TradesStreamStore } from './TradesStreamStore';

const MS_PER_SECOND = 1000;
const SECOND_T_MS = 1_700_000_000_000 as UnixTimeMs;

let liveTradesSubject: Subject<ReadonlyArray<ITrade>>;
let nextTradeId = 1;

function makeTrade(params: {
  readonly eventTimeMs: UnixTimeMs;
  readonly price: number;
  readonly quantity: number;
  readonly isBuyerMaker: boolean;
}): ITrade {
  nextTradeId += 1;
  return {
    tradeId: nextTradeId as TradeId,
    eventTimeMs: params.eventTimeMs,
    price: params.price,
    quantity: params.quantity as Quantity,
    isBuyerMaker: params.isBuyerMaker,
  };
}

class FakeOrderbookGate implements IOrderbookGate {
  hasFirstOrderbookSnapshot = false;
}

interface IFakeTradesDbState {
  readonly putBlockCalls: ITradeBlockRecord[];
  readonly putRawTradesCalls: ITradeBucketRawRecord[];
}

function createFakeBinanceDb(): { db: IBinanceDb; state: IFakeTradesDbState } {
  const state: IFakeTradesDbState = {
    putBlockCalls: [],
    putRawTradesCalls: [],
  };
  const db: IBinanceDb = {
    orderbook: {
      clearAll: async () => undefined,
      putBlock: async () => undefined,
      getBlock: async () => undefined,
      deleteBlock: async () => undefined,
      countBlocks: async () => 0,
      close: () => undefined,
    },
    midPrice: {
      clearAll: async () => undefined,
      putBlock: async () => undefined,
      getBlock: async () => undefined,
      deleteBlock: async () => undefined,
      countBlocks: async () => 0,
    },
    trades: {
      clearAll: async () => undefined,
      putBlock: async record => {
        state.putBlockCalls.push(record);
      },
      getBlock: async () => undefined,
      deleteBlock: async () => undefined,
      putRawTrades: async record => {
        state.putRawTradesCalls.push(record);
      },
      getRawTrades: async () => undefined,
      deleteRawTrades: async () => undefined,
      countBlocks: async () => 0,
    },
    clearAll: async () => undefined,
    close: () => undefined,
  };
  return { db, state };
}

interface IFakeChartState {
  readonly tradesIndex: ReturnType<typeof createTradesBlockIndex>;
  ingestTradesFlush(event: ITradeBlockFlushEventBridge): void;
  releaseTradesBlockSlot(blockId: UnixTimeMs): void;
  getTradesLayerLastFrameStats(): undefined;
  dispose(): void;
}

/**
 * Structural stand-in for `BinanceChartState`. Only implements the
 * methods the trades store touches at runtime — everything else is
 * elided. Cast to `BinanceChartState` at the call site so the typing
 * boundary stays intact.
 */
function createFakeChartState(): IFakeChartState {
  const tradesIndex = createTradesBlockIndex();
  return {
    tradesIndex,
    ingestTradesFlush(event: ITradeBlockFlushEventBridge): void {
      const meta = event.block;
      const item: ITradeBlockIndexItem = {
        minX: meta.firstBucketStartMs,
        maxX: meta.lastBucketStartMs,
        minY: 0,
        maxY: 0,
        blockId: meta.blockId,
        textureRowIndex: meta.textureRowIndex,
        bucketCount: meta.bucketCount,
        basePrice: meta.basePrice,
      };
      tradesIndex.upsert(item);
    },
    releaseTradesBlockSlot(blockId: UnixTimeMs): void {
      tradesIndex.remove(blockId);
    },
    getTradesLayerLastFrameStats(): undefined {
      return undefined;
    },
    dispose(): void {
      tradesIndex.clear();
    },
  };
}

beforeAll(() => {
  // The `runInAction` wrappers in `handleFlush` rely on MobX's strict
  // mode being on (matches `main.tsx`). Configure here so the test
  // environment matches the production behaviour.
  configure({ enforceActions: 'always' });
});

beforeEach(() => {
  liveTradesSubject = new Subject<ReadonlyArray<ITrade>>();
});

afterEach(() => {
  liveTradesSubject.complete();
});

interface IBuildStoreResult {
  readonly store: TradesStreamStore;
  readonly chartState: IFakeChartState;
  readonly gate: FakeOrderbookGate;
  readonly dbState: IFakeTradesDbState;
}

function buildStore(): IBuildStoreResult {
  const chartState = createFakeChartState();
  const gate = new FakeOrderbookGate();
  const { db, state: dbState } = createFakeBinanceDb();
  const store = new TradesStreamStore({
    chartState: chartState as unknown as BinanceChartState,
    db,
    instrument: BINANCE_CONFIG.instrument,
    gate,
  });
  return { store, chartState, gate, dbState };
}

describe('TradesStreamStore', () => {
  it('drops trades arriving before the first orderbook snapshot', () => {
    const { store, chartState } = buildStore();
    store.startStream();

    liveTradesSubject.next([
      makeTrade({
        eventTimeMs: SECOND_T_MS,
        price: 100,
        quantity: 1,
        isBuyerMaker: false,
      }),
    ]);

    expect(store.tradesReceivedCount).toBe(0);
    expect(store.tradesConnection).toBe('connecting');
    expect(chartState.tradesIndex.size).toBe(0);

    store.dispose();
  });

  it('once gate opens, trades are counted and bucket flushes propagate to chart-state and IDB', async () => {
    const { store, chartState, gate, dbState } = buildStore();
    store.startStream();

    gate.hasFirstOrderbookSnapshot = true;

    // First batch: opens the active bucket at second T (no flush yet).
    liveTradesSubject.next([
      makeTrade({
        eventTimeMs: SECOND_T_MS,
        price: 100,
        quantity: 2,
        isBuyerMaker: false,
      }),
    ]);
    expect(store.tradesReceivedCount).toBe(1);
    expect(store.tradesConnection).toBe('connected');

    // Second batch one second later: closes the prior bucket → flush.
    liveTradesSubject.next([
      makeTrade({
        eventTimeMs: (SECOND_T_MS + MS_PER_SECOND) as UnixTimeMs,
        price: 101,
        quantity: 1,
        isBuyerMaker: true,
      }),
    ]);
    expect(store.tradesReceivedCount).toBe(2);
    expect(chartState.tradesIndex.findByBlockId(SECOND_T_MS)).toBeDefined();

    // Raw trades for the closed bucket are cached for the popup.
    const rawTrades = store.getRawTradesForBucket(SECOND_T_MS, SECOND_T_MS);
    expect(rawTrades?.length).toBe(1);

    // IDB persistence: aggregate written every flush; raw trades on
    // rotation only.
    await flushMicrotasks();
    expect(dbState.putBlockCalls.length).toBeGreaterThanOrEqual(1);

    store.dispose();
  });

  it('persists the CLOSED block raw trades to trade-buckets-raw on rotation', async () => {
    const { store, gate, dbState } = buildStore();
    store.startStream();
    gate.hasFirstOrderbookSnapshot = true;

    // Fill an entire block (MAX_BUCKETS_PER_BLOCK closed buckets) plus one
    // extra second to trigger rotation. Each distinct second contributes a
    // bucket with exactly one raw trade; the second that closes the block
    // is what rotates it and seals the closed block.
    const lastSecondIndex = MAX_BUCKETS_PER_BLOCK; // 0..MAX inclusive
    for (let secondIndex = 0; secondIndex <= lastSecondIndex; secondIndex++) {
      liveTradesSubject.next([
        makeTrade({
          eventTimeMs: (SECOND_T_MS + secondIndex * MS_PER_SECOND) as UnixTimeMs,
          price: 100 + secondIndex,
          quantity: 1,
          isBuyerMaker: false,
        }),
      ]);
    }

    await flushMicrotasks();

    // Exactly one raw-trade dump must have landed — for the sealed (closed
    // by rotation) block, which is the FIRST block, keyed by SECOND_T_MS.
    const closedBlockRaw = dbState.putRawTradesCalls.find(record => record.blockId === SECOND_T_MS);
    expect(closedBlockRaw).toBeDefined();
    // The closed block must carry its actual raw trades, not an empty map.
    expect(closedBlockRaw?.bucketsRaw.length).toBe(MAX_BUCKETS_PER_BLOCK);
    const totalPersistedTrades = (closedBlockRaw?.bucketsRaw ?? []).reduce(
      (sum, bucket) => sum + bucket.trades.length,
      0
    );
    expect(totalPersistedTrades).toBe(MAX_BUCKETS_PER_BLOCK);

    // The fresh EMPTY block must NOT have been persisted with empty raw
    // trades — the only raw-trade dump is the sealed block.
    expect(dbState.putRawTradesCalls.length).toBe(1);

    store.dispose();
  });

  it('getRawTradesForBucket returns undefined for unknown keys', () => {
    const { store } = buildStore();

    expect(store.getRawTradesForBucket(0 as UnixTimeMs, 0 as UnixTimeMs)).toBeUndefined();

    store.dispose();
  });

  it('selectBucketAt toggles the pinned bucket on repeat selection of the same target', () => {
    const { store, gate } = buildStore();
    store.startStream();
    gate.hasFirstOrderbookSnapshot = true;

    // Drive a single closed bucket so the spatial index has a hit.
    liveTradesSubject.next([
      makeTrade({
        eventTimeMs: SECOND_T_MS,
        price: 100,
        quantity: 2,
        isBuyerMaker: false,
      }),
    ]);
    liveTradesSubject.next([
      makeTrade({
        eventTimeMs: (SECOND_T_MS + MS_PER_SECOND) as UnixTimeMs,
        price: 100,
        quantity: 1,
        isBuyerMaker: false,
      }),
    ]);

    // The fake `worldToPx` collapses every world point onto the pointer
    // position, so the hit-test reduces to "distance(0, 0) ≤ hitRadius"
    // — guaranteed true.
    const pointer = {
      worldTimeMs: SECOND_T_MS,
      priceTickPx: 10,
      msPerPx: 0,
      pointerPx: { x: 50, y: 50 },
      worldToPx: () => ({ x: 50, y: 50 }),
    };

    store.selectBucketAt(pointer);
    expect(store.pinnedBucket?.bucketStartMs).toBe(SECOND_T_MS);

    // Selecting the same bucket again unpins.
    store.selectBucketAt(pointer);
    expect(store.pinnedBucket).toBeUndefined();

    store.dispose();
  });

  it('setHoveredBucketAt + clearHoveredBucket round-trip the hovered key', () => {
    const { store, gate } = buildStore();
    store.startStream();
    gate.hasFirstOrderbookSnapshot = true;

    liveTradesSubject.next([
      makeTrade({
        eventTimeMs: SECOND_T_MS,
        price: 100,
        quantity: 1,
        isBuyerMaker: false,
      }),
    ]);
    liveTradesSubject.next([
      makeTrade({
        eventTimeMs: (SECOND_T_MS + MS_PER_SECOND) as UnixTimeMs,
        price: 100,
        quantity: 1,
        isBuyerMaker: false,
      }),
    ]);

    const pointer = {
      worldTimeMs: SECOND_T_MS,
      priceTickPx: 10,
      msPerPx: 0,
      pointerPx: { x: 50, y: 50 },
      worldToPx: () => ({ x: 50, y: 50 }),
    };

    store.setHoveredBucketAt(pointer);
    expect(store.hoveredBucketKey).toBe(SECOND_T_MS);

    store.clearHoveredBucket();
    expect(store.hoveredBucketKey).toBeUndefined();

    store.dispose();
  });

  it('dispose() resets observable state and clears caches', () => {
    const { store, gate } = buildStore();
    store.startStream();
    gate.hasFirstOrderbookSnapshot = true;

    liveTradesSubject.next([
      makeTrade({
        eventTimeMs: SECOND_T_MS,
        price: 100,
        quantity: 1,
        isBuyerMaker: false,
      }),
    ]);
    liveTradesSubject.next([
      makeTrade({
        eventTimeMs: (SECOND_T_MS + MS_PER_SECOND) as UnixTimeMs,
        price: 100,
        quantity: 1,
        isBuyerMaker: false,
      }),
    ]);
    expect(store.tradesReceivedCount).toBe(2);
    expect(store.getRawTradesForBucket(SECOND_T_MS, SECOND_T_MS)).toBeDefined();

    store.dispose();
    expect(store.tradesReceivedCount).toBe(0);
    expect(store.tradesConnection).toBe('idle');
    expect(store.tradesErrorMessage).toBeUndefined();
    expect(store.pinnedBucket).toBeUndefined();
    expect(store.hoveredBucketKey).toBeUndefined();
    expect(store.getRawTradesForBucket(SECOND_T_MS, SECOND_T_MS)).toBeUndefined();
  });
});

/**
 * Yield to the microtask + macrotask queues so any
 * `void this.persistAggregateBlock(event)` / `void this.persistRawTrades(event)`
 * continuations land before the test's expectation pass.
 */
function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}
