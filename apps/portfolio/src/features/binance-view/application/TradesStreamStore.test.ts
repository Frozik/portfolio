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
