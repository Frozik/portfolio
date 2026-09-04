import 'fake-indexeddb/auto';

import type { ValueDescriptorFail } from '@frozik/utils/value-descriptors/types';
import { configure } from 'mobx';
import { Subject } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../infrastructure/trades-stream', () => {
  return {
    liveTrades$: () => liveTradesSubject,
    mapRawAggTradeToITrade: vi.fn(),
  };
});

import type { IBinanceDb } from '../domain/binance-db';
import { createTradesBlockIndex } from '../domain/block-store/create-trades-block-index';
import { BINANCE_CONFIG } from '../domain/config';
import type { ITradeBlockFlushEvent } from '../domain/flush-events';
import { MAX_BUCKETS_PER_BLOCK } from '../domain/trades-constants';
import type {
  ITrade,
  ITradeBlockRecord,
  ITradeBucketRawRecord,
  Quantity,
  TradeId,
} from '../domain/trades-types';
import type { UnixTimeMs } from '../domain/types';
import type { BinanceChartState } from './chart-state';
import type { IOrderbookGate } from './IOrderbookGate';
import { PersistenceGate } from './persistence-gate';
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
  failWrites: boolean;
}

function createFakeBinanceDb(): { db: IBinanceDb; state: IFakeTradesDbState } {
  const state: IFakeTradesDbState = { putBlockCalls: [], putRawTradesCalls: [], failWrites: false };
  const db: IBinanceDb = {
    orderbook: {
      clearAll: async () => undefined,
      putBlock: async () => undefined,
      getBlock: async () => undefined,
      deleteBlock: async () => undefined,
      countBlocks: async () => 0,
      close: () => undefined,
    },
    candles: {
      clearAll: async () => undefined,
      putBlock: async () => undefined,
      getBlock: async () => undefined,
      deleteBlock: async () => undefined,
      countBlocks: async () => 0,
    },
    trades: {
      clearAll: async () => undefined,
      putBlock: async record => {
        if (state.failWrites) {
          throw new Error('quota exceeded');
        }
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

/** Structural stand-in for `BinanceChartState`: only the surface the trades store touches. */
function createFakeChartState(): Pick<
  BinanceChartState,
  'tradesIndex' | 'ingestTradesFlush' | 'releaseTradesBlockSlot'
> {
  const tradesIndex = createTradesBlockIndex();
  return {
    tradesIndex,
    ingestTradesFlush(event: ITradeBlockFlushEvent): void {
      const meta = event.block;
      tradesIndex.upsert({
        minX: meta.firstBucketStartMs,
        maxX: meta.lastBucketStartMs,
        minY: 0,
        maxY: 0,
        blockId: meta.blockId,
        textureRowIndex: undefined,
        bucketCount: meta.bucketCount,
        basePrice: meta.basePrice,
      });
    },
    releaseTradesBlockSlot(blockId: UnixTimeMs): void {
      tradesIndex.remove(blockId);
    },
  };
}

beforeAll(() => {
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
  readonly chartState: ReturnType<typeof createFakeChartState>;
  readonly gate: FakeOrderbookGate;
  readonly dbState: IFakeTradesDbState;
  readonly persistenceFailures: ValueDescriptorFail[];
}

function buildStore(): IBuildStoreResult {
  const chartState = createFakeChartState();
  const gate = new FakeOrderbookGate();
  const { db, state: dbState } = createFakeBinanceDb();
  const persistenceFailures: ValueDescriptorFail[] = [];
  const store = new TradesStreamStore({
    chartState: chartState as BinanceChartState,
    persistence: new PersistenceGate(db, reason => persistenceFailures.push(reason)),
    instrument: BINANCE_CONFIG.instrument,
    gate,
  });
  return { store, chartState, gate, dbState, persistenceFailures };
}

function emitTrade(eventTimeMs: UnixTimeMs, price = 100, quantity = 1, isBuyerMaker = false): void {
  liveTradesSubject.next([makeTrade({ eventTimeMs, price, quantity, isBuyerMaker })]);
}

/** Sits at the start of the first bucket's one-second slot. */
const FIRST_BUCKET_POINTER = {
  worldTimeMs: SECOND_T_MS,
  pointerPx: { x: 50, y: 50 },
};

describe('TradesStreamStore', () => {
  it('drops trades arriving before the first orderbook snapshot', () => {
    const { store, chartState } = buildStore();
    store.startStream();

    emitTrade(SECOND_T_MS);

    expect(store.tradesReceivedCount).toBe(0);
    expect(store.tradesConnection).toBe('connecting');
    expect(chartState.tradesIndex.size).toBe(0);

    store.dispose();
  });

  it('once the gate opens, a closed bucket reaches the chart state, the RAM cache and IndexedDB', async () => {
    const { store, chartState, gate, dbState } = buildStore();
    store.startStream();
    gate.hasFirstOrderbookSnapshot = true;

    emitTrade(SECOND_T_MS, 100, 2);
    expect(store.tradesReceivedCount).toBe(1);
    expect(store.tradesConnection).toBe('connected');

    emitTrade((SECOND_T_MS + MS_PER_SECOND) as UnixTimeMs, 101, 1, true);
    expect(store.tradesReceivedCount).toBe(2);
    expect(chartState.tradesIndex.findByBlockId(SECOND_T_MS)).toBeDefined();
    expect(store.getRawTradesForBucket(SECOND_T_MS, SECOND_T_MS)?.length).toBe(1);

    await flushMicrotasks();
    expect(dbState.putBlockCalls.length).toBeGreaterThanOrEqual(1);

    store.dispose();
  });

  it('persists the sealed block raw trades exactly once, on rotation', async () => {
    const { store, gate, dbState } = buildStore();
    store.startStream();
    gate.hasFirstOrderbookSnapshot = true;

    for (let secondIndex = 0; secondIndex <= MAX_BUCKETS_PER_BLOCK; secondIndex++) {
      emitTrade((SECOND_T_MS + secondIndex * MS_PER_SECOND) as UnixTimeMs, 100 + secondIndex);
    }

    await flushMicrotasks();

    const closedBlockRaw = dbState.putRawTradesCalls.find(record => record.blockId === SECOND_T_MS);
    expect(closedBlockRaw?.bucketsRaw.length).toBe(MAX_BUCKETS_PER_BLOCK);
    const totalPersistedTrades = (closedBlockRaw?.bucketsRaw ?? []).reduce(
      (sum, bucket) => sum + bucket.trades.length,
      0
    );
    expect(totalPersistedTrades).toBe(MAX_BUCKETS_PER_BLOCK);
    expect(dbState.putRawTradesCalls.length).toBe(1);

    store.dispose();
  });

  it('reports a failed write once and stops persisting instead of logging', async () => {
    const { store, gate, dbState, persistenceFailures } = buildStore();
    store.startStream();
    gate.hasFirstOrderbookSnapshot = true;
    dbState.failWrites = true;

    emitTrade(SECOND_T_MS);
    emitTrade((SECOND_T_MS + MS_PER_SECOND) as UnixTimeMs);
    emitTrade((SECOND_T_MS + 2 * MS_PER_SECOND) as UnixTimeMs);
    await flushMicrotasks();

    expect(persistenceFailures.length).toBe(1);
    expect(persistenceFailures[0]?.meta.message).toBe('quota exceeded');

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

    emitTrade(SECOND_T_MS, 100, 2);
    emitTrade((SECOND_T_MS + MS_PER_SECOND) as UnixTimeMs);

    store.selectBucketAt(FIRST_BUCKET_POINTER);
    expect(store.pinnedBucket?.bucketStartMs).toBe(SECOND_T_MS);

    store.selectBucketAt(FIRST_BUCKET_POINTER);
    expect(store.pinnedBucket).toBeUndefined();

    store.dispose();
  });

  it('setHoveredBucketAt + clearHoveredBucket round-trip the hovered key', () => {
    const { store, gate } = buildStore();
    store.startStream();
    gate.hasFirstOrderbookSnapshot = true;

    emitTrade(SECOND_T_MS);
    emitTrade((SECOND_T_MS + MS_PER_SECOND) as UnixTimeMs);

    store.setHoveredBucketAt(FIRST_BUCKET_POINTER);
    expect(store.hoveredBucketKey).toBe(SECOND_T_MS);

    store.clearHoveredBucket();
    expect(store.hoveredBucketKey).toBeUndefined();

    store.dispose();
  });

  it('dispose() resets observable state and clears caches', () => {
    const { store, gate } = buildStore();
    store.startStream();
    gate.hasFirstOrderbookSnapshot = true;

    emitTrade(SECOND_T_MS);
    emitTrade((SECOND_T_MS + MS_PER_SECOND) as UnixTimeMs);
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

/** Lets the fire-and-forget persistence continuations land before the assertions. */
function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}
