import { isNil } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';
import type { Subscription } from 'rxjs';

import { BINANCE_CONFIG } from '../domain/config';
import type { ITradeBlockFlushEvent } from '../domain/flush-events';
import type { InstrumentSymbol } from '../domain/instruments';
import { RawTradesCache } from '../domain/raw-trades-cache';
import {
  ACTIVE_BUCKET_RAW_TRADES_SOFT_CAP,
  FLOATS_PER_BUCKET,
  MAX_BUCKETS_PER_BLOCK,
  MAX_RAW_TRADES_BLOCKS_IN_RAM,
  MAX_TRADE_BLOCKS_IN_RAM,
} from '../domain/trades-constants';
import type { ITradeHitTestPointer } from '../domain/trades-hit-test';
import { decodeBucketAt, findBucketsAt, pickMostRecentBucket } from '../domain/trades-hit-test';
import type {
  IClosedTradeBucket,
  ITrade,
  ITradeBucket,
  ITradeBucketHitTestResult,
} from '../domain/trades-types';
import type { ConnectionState, UnixTimeMs } from '../domain/types';
import { TradeBucketAccumulator } from '../infrastructure/trade-bucket-accumulator';
import {
  loadRawTradesFromDb,
  persistAggregateBlock,
  persistRawTrades,
} from '../infrastructure/trades-persistence';
import { liveTrades$ } from '../infrastructure/trades-stream';
import type { BinanceChartState } from './chart-state';
import type { IOrderbookGate } from './IOrderbookGate';
import type { PersistenceGate } from './persistence-gate';

export interface ITradesStreamStoreParams {
  readonly chartState: BinanceChartState;
  readonly persistence: PersistenceGate;
  readonly instrument: InstrumentSymbol;
  readonly gate: IOrderbookGate;
  /** Fan-out of every closed second to the candle store. */
  readonly onBucketClosed?: (bucket: IClosedTradeBucket) => void;
}

/**
 * Owns the live trades subscription, the bucket accumulator, the raw-trade
 * RAM cache and the hover / pinned bucket selection.
 *
 * Trades that arrive before the first orderbook snapshot are dropped: the
 * trade-block time encoding resolves against the orderbook's coordinate
 * frame, which does not exist yet. Once {@link IOrderbookGate} opens it
 * stays open across reconnects until `dispose`.
 */
export class TradesStreamStore {
  tradesConnection: ConnectionState = 'idle';
  tradesErrorMessage: string | undefined = undefined;
  tradesReceivedCount = 0;
  lastTradeTimeMs: UnixTimeMs | undefined = undefined;
  pinnedBucket: ITradeBucketHitTestResult | undefined = undefined;
  hoveredBucketKey: UnixTimeMs | undefined = undefined;

  private readonly chartState: BinanceChartState;
  private readonly persistence: PersistenceGate;
  private readonly instrument: InstrumentSymbol;
  private readonly gate: IOrderbookGate;
  private readonly onBucketClosed: ((bucket: IClosedTradeBucket) => void) | undefined;

  private accumulator: TradeBucketAccumulator | undefined = undefined;
  private subscription: Subscription | undefined = undefined;
  private readonly rawTrades = new RawTradesCache(MAX_RAW_TRADES_BLOCKS_IN_RAM);
  /** Per-block reload generation: only the latest concurrent reload may publish. */
  private readonly reloadTokens = new Map<UnixTimeMs, number>();
  /** Block aggregates by reference, so hit-tests decode buckets without touching the renderer. */
  private readonly blockData = new Map<UnixTimeMs, Float32Array>();

  constructor(params: ITradesStreamStoreParams) {
    this.chartState = params.chartState;
    this.persistence = params.persistence;
    this.instrument = params.instrument;
    this.gate = params.gate;
    this.onBucketClosed = params.onBucketClosed;

    makeAutoObservable<TradesStreamStore, 'rawTrades' | 'reloadTokens' | 'blockData'>(
      this,
      // Hot-path caches with thousands of nested trades: deep tracking would re-proxy
      // every entry per flush for no reactive benefit.
      { rawTrades: false, reloadTokens: false, blockData: false },
      { autoBind: true }
    );
  }

  startStream(): void {
    if (!isNil(this.subscription)) {
      return;
    }
    this.tradesConnection = 'connecting';
    this.tradesErrorMessage = undefined;

    this.accumulator = new TradeBucketAccumulator({
      maxBucketsPerBlock: MAX_BUCKETS_PER_BLOCK,
      floatsPerBucket: FLOATS_PER_BUCKET,
      activeBucketRawTradesSoftCap: ACTIVE_BUCKET_RAW_TRADES_SOFT_CAP,
      onFlush: this.handleFlush,
      onBucketClosed: this.onBucketClosed,
    });

    this.subscription = liveTrades$({
      streamHost: BINANCE_CONFIG.streamHost,
      instrument: this.instrument,
      reconnectDelayMs: BINANCE_CONFIG.reconnectDelayMs,
    }).subscribe({
      next: this.handleTradeBatch,
      error: this.handleStreamError,
    });
  }

  dispose(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    this.accumulator?.dispose();
    this.accumulator = undefined;
    this.rawTrades.clear();
    this.reloadTokens.clear();
    this.blockData.clear();
    this.pinnedBucket = undefined;
    this.hoveredBucketKey = undefined;
    this.tradesConnection = 'idle';
    this.tradesErrorMessage = undefined;
    this.tradesReceivedCount = 0;
    this.lastTradeTimeMs = undefined;
  }

  /** `undefined` once the block left the RAM cache — the popup then asks for {@link loadRawTradesFromIDB}. */
  getRawTradesForBucket(
    blockId: UnixTimeMs,
    bucketStartMs: UnixTimeMs
  ): readonly ITrade[] | undefined {
    return this.rawTrades.get(blockId, bucketStartMs);
  }

  async loadRawTradesFromIDB(blockId: UnixTimeMs): Promise<void> {
    const db = this.persistence.db;
    if (isNil(db)) {
      return;
    }
    const generation = (this.reloadTokens.get(blockId) ?? 0) + 1;
    this.reloadTokens.set(blockId, generation);

    const result = await loadRawTradesFromDb(db.trades, blockId);
    if (this.reloadTokens.get(blockId) !== generation) {
      return;
    }
    switch (result.kind) {
      case 'loaded':
        runInAction(() => {
          this.rawTrades.set(blockId, result.buckets);
        });
        return;
      case 'failed':
        this.persistence.disable(result.reason);
        return;
      case 'missing':
        return;
    }
  }

  selectBucketAt(pointer: ITradeHitTestPointer): void {
    const hit = pickMostRecentBucket(this.findBucketsAt(pointer));
    if (isNil(hit) || this.pinnedBucket?.bucketStartMs === hit.bucketStartMs) {
      this.pinnedBucket = undefined;
      return;
    }
    this.pinnedBucket = hit;
  }

  /**
   * Sticky hover: the current bucket keeps the hover while the cursor stays
   * inside its hit-zone; otherwise the most recent candidate wins, matching
   * the renderer's z-lift order.
   */
  setHoveredBucketAt(pointer: ITradeHitTestPointer): void {
    const candidates = this.findBucketsAt(pointer);
    const currentHover = this.hoveredBucketKey;
    if (
      !isNil(currentHover) &&
      candidates.some(candidate => candidate.bucketStartMs === currentHover)
    ) {
      return;
    }
    const nextKey = pickMostRecentBucket(candidates)?.bucketStartMs;
    if (nextKey !== this.hoveredBucketKey) {
      this.hoveredBucketKey = nextKey;
    }
  }

  clearPinnedBucket(): void {
    this.pinnedBucket = undefined;
  }

  clearHoveredBucket(): void {
    this.hoveredBucketKey = undefined;
  }

  get hoveredBucket(): ITradeBucket | undefined {
    if (isNil(this.hoveredBucketKey)) {
      return undefined;
    }
    return decodeBucketAt(this.hoveredBucketKey, this.chartState.tradesIndex, this.blockData);
  }

  private findBucketsAt(pointer: ITradeHitTestPointer): readonly ITradeBucketHitTestResult[] {
    return findBucketsAt(pointer, this.chartState.tradesIndex, this.blockData);
  }

  private handleTradeBatch(batch: readonly ITrade[]): void {
    if (!this.gate.hasFirstOrderbookSnapshot) {
      return;
    }
    this.tradesConnection = 'connected';
    this.tradesReceivedCount += batch.length;
    // Timestamps within a batch are non-decreasing, so the last entry is the freshest.
    const newest = batch.at(-1)?.eventTimeMs;
    if (!isNil(newest)) {
      this.lastTradeTimeMs = newest;
    }
    for (const trade of batch) {
      this.accumulator?.addTrade(trade);
    }
  }

  private handleFlush(event: ITradeBlockFlushEvent): void {
    this.chartState.ingestTradesFlush(event);
    this.blockData.set(event.block.blockId, event.data);
    this.rawTrades.set(event.block.blockId, new Map(event.rawTradesByBucket));

    if (event.isNewBlock) {
      this.enforceTradesHistoryCap();
    }

    this.persistence.write(async db => {
      const aggregateFail = await persistAggregateBlock(db.trades, event);
      const rawFail = event.closedByRotation ? await persistRawTrades(db.trades, event) : undefined;
      const fail = aggregateFail ?? rawFail;
      if (!isNil(fail)) {
        this.persistence.disable(fail);
      }
    });
  }

  private enforceTradesHistoryCap(): void {
    const tradesIndex = this.chartState.tradesIndex;
    while (tradesIndex.size > MAX_TRADE_BLOCKS_IN_RAM) {
      const oldestStartMs = tradesIndex.oldestStartMs();
      if (isNil(oldestStartMs)) {
        return;
      }
      this.chartState.releaseTradesBlockSlot(oldestStartMs);
      this.blockData.delete(oldestStartMs);
      this.rawTrades.delete(oldestStartMs);
      this.persistence.write(db => db.trades.deleteBlock(oldestStartMs));
      this.persistence.write(db => db.trades.deleteRawTrades(oldestStartMs));
    }
  }

  private handleStreamError(error: unknown): void {
    this.tradesConnection = 'error';
    this.tradesErrorMessage = error instanceof Error ? error.message : String(error);
  }
}
