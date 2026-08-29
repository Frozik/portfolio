import { makeAutoObservable, runInAction } from 'mobx';
import type { Subscription } from 'rxjs';
import type { IBinanceDb } from '../domain/binance-db';
import { BINANCE_CONFIG } from '../domain/config';
import {
  ACTIVE_BUCKET_RAW_TRADES_SOFT_CAP,
  FLOATS_PER_BUCKET,
  MAX_BUCKETS_PER_BLOCK,
  MAX_RAW_TRADES_BLOCKS_IN_RAM,
  MAX_TRADE_BLOCKS_IN_RAM,
} from '../domain/trades-constants';
import type { ITradeHitTestPointer } from '../domain/trades-hit-test';
import { decodeBucketAt, findBucketsAt, pickMostRecentBucket } from '../domain/trades-hit-test';
import type { ITrade, ITradeBucket, ITradeBucketHitTestResult } from '../domain/trades-types';
import type { ConnectionState, UnixTimeMs } from '../domain/types';
import type { ITradeBlockFlushEvent } from '../infrastructure/trade-bucket-accumulator';
import { TradeBucketAccumulator } from '../infrastructure/trade-bucket-accumulator';
import {
  loadRawTradesFromDb,
  persistAggregateBlock,
  persistRawTrades,
} from '../infrastructure/trades-persistence';
import { liveTrades$ } from '../infrastructure/trades-stream';
import type { BinanceChartState } from './chart-state';

import type { IOrderbookGate } from './IOrderbookGate';

// IDB persistence: aggregates on every flush, raw trades only on the
// `closedByRotation` event (the sealed block carrying its final
// rawTradesByBucket).

export type { ITradeHitTestPointer } from '../domain/trades-hit-test';

export interface ITradesStreamStoreParams {
  readonly chartState: BinanceChartState;
  readonly db: IBinanceDb | undefined;
  readonly instrument: string;
  readonly gate: IOrderbookGate;
}

/**
 * Per-stream sub-store extracted from the legacy `BinanceViewStore`
 * god-store. Owns the live trades subscription, the trade-
 * bucket accumulator, raw-trade RAM cache, and connection-state
 * indicators surfaced by the trades surface.
 *
 * Trade ingest is gated on the first-snapshot sentinel exposed by
 * {@link IOrderbookGate}: trades arriving before the first orderbook
 * snapshot are dropped because the trade-block timeDelta encoding
 * resolves against a not-yet-defined system of coordinates. Once the
 * sentinel flips, the gate stays open for the rest of the store's
 * lifetime (incl. across orderbook WS reconnects) — only `dispose`
 * resets it.
 *
 * Pinned/hovered bucket fields ({@link pinnedBucket},
 * {@link hoveredBucketKey}) are observable seats populated by the
 * presentation layer when the pointer math is wired in
 * `BinanceView.tsx`. Hit-test resolution lives in pure domain
 * functions (`domain/trades-hit-test.ts`) — this store only feeds
 * them the in-RAM block data and applies the click/hover policies.
 */
export class TradesStreamStore {
  tradesConnection: ConnectionState = 'idle';
  tradesErrorMessage: string | undefined = undefined;
  tradesReceivedCount = 0;
  /** `eventTimeMs` of the most recent trade observed, or `undefined` before the first batch. */
  lastTradeTimeMs: UnixTimeMs | undefined = undefined;
  pinnedBucket: ITradeBucketHitTestResult | undefined = undefined;
  hoveredBucketKey: UnixTimeMs | undefined = undefined;

  private readonly chartState: BinanceChartState;
  private readonly db: IBinanceDb | undefined;
  private readonly instrument: string;
  private readonly gate: IOrderbookGate;

  private accumulator: TradeBucketAccumulator | undefined = undefined;
  private subscription: Subscription | undefined = undefined;

  /**
   * RAM cache of raw trades for recently-flushed blocks, used by the
   * popup table when the user clicks a bucket. Outer key is `blockId`,
   * inner map is `bucketStartMs → ITrade[]`. Bounded by
   * {@link MAX_RAW_TRADES_BLOCKS_IN_RAM} — older blocks fall through
   * to lazy IDB reload.
   */
  private readonly recentBucketRawTrades = new Map<UnixTimeMs, Map<UnixTimeMs, ITrade[]>>();
  /**
   * Insertion-ordered set of `blockId`s currently held in
   * {@link recentBucketRawTrades}. Used as a FIFO eviction queue when
   * the cap is exceeded — `Set` insertion order is preserved by JS
   * spec, so the oldest entry is always `set.values().next().value`.
   * `Set` over `Array` here keeps the cap-trim and eviction paths
   * `O(1)` (the array `indexOf`/`splice` was `O(n)` and grew with
   * `MAX_RAW_TRADES_BLOCKS_IN_RAM`).
   */
  private readonly recentBlockOrder = new Set<UnixTimeMs>();
  /**
   * Per-block reload-token guard against races: when the same block is
   * reloaded concurrently (e.g. a fresh hover overrides an older
   * click), only the last reload is allowed to mutate the cache.
   */
  private readonly reloadTokens = new Map<UnixTimeMs, number>();
  /**
   * Authoritative `Float32Array` reference for every flushed block
   * — kept alongside the renderer's own copy so the store can decode
   * bucket aggregates synchronously when the popup needs them.
   */
  private readonly blockData = new Map<UnixTimeMs, Float32Array>();

  constructor(params: ITradesStreamStoreParams) {
    this.chartState = params.chartState;
    this.db = params.db;
    this.instrument = params.instrument;
    this.gate = params.gate;

    makeAutoObservable<
      TradesStreamStore,
      'recentBucketRawTrades' | 'recentBlockOrder' | 'reloadTokens' | 'blockData'
    >(
      this,
      {
        // Heavy non-UI caches mutated on the hot `flush` path (the raw-
        // trades map nests up to ~2000 `ITrade` objects per block, plus
        // the per-block `Float32Array` aggregates). MobX deep-tracking
        // them would re-proxy every nested entry on each flush for zero
        // reactive benefit: the only observable triggers consumers depend
        // on are the `hoveredBucketKey` / `pinnedBucket` UI seats, which
        // drive the `hoveredBucket` getter and the popup's raw-trade read.
        // Keeping the caches raw also lets us assign them outside
        // `runInAction` without tripping strict-mode warnings.
        recentBucketRawTrades: false,
        recentBlockOrder: false,
        reloadTokens: false,
        blockData: false,
      },
      { autoBind: true }
    );
  }

  startStream(): void {
    if (this.subscription !== undefined) {
      return;
    }
    this.tradesConnection = 'connecting';
    this.tradesErrorMessage = undefined;

    this.accumulator = new TradeBucketAccumulator({
      maxBucketsPerBlock: MAX_BUCKETS_PER_BLOCK,
      floatsPerBucket: FLOATS_PER_BUCKET,
      activeBucketRawTradesSoftCap: ACTIVE_BUCKET_RAW_TRADES_SOFT_CAP,
      onFlush: this.handleFlush,
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
    this.recentBucketRawTrades.clear();
    this.recentBlockOrder.clear();
    this.reloadTokens.clear();
    this.blockData.clear();
    this.pinnedBucket = undefined;
    this.hoveredBucketKey = undefined;
    this.tradesConnection = 'idle';
    this.tradesErrorMessage = undefined;
    this.tradesReceivedCount = 0;
    this.lastTradeTimeMs = undefined;
  }

  /**
   * Synchronous read of raw trades for a closed bucket. Returns
   * `undefined` when the block has been evicted from RAM — the popup
   * is responsible for kicking off a lazy IDB reload in that case.
   */
  getRawTradesForBucket(
    blockId: UnixTimeMs,
    bucketStartMs: UnixTimeMs
  ): readonly ITrade[] | undefined {
    return this.recentBucketRawTrades.get(blockId)?.get(bucketStartMs);
  }

  /**
   * Lazy IDB reload for the popup. When the user clicks a bucket
   * whose block has been evicted from {@link recentBucketRawTrades},
   * the popup calls this to restore the entry from `trade-buckets-raw`.
   *
   * Per-`blockId` reload generation guards against races: if the same
   * block is reloaded concurrently (e.g. a fresh hover overrides an
   * older click), only the last reload is allowed to mutate the cache.
   *
   * The cap-trim runs on flush, not here — a lazy-loaded block can
   * temporarily push the cache one entry over
   * {@link MAX_RAW_TRADES_BLOCKS_IN_RAM} until the next flush, which
   * is acceptable.
   */
  async loadRawTradesFromIDB(blockId: UnixTimeMs): Promise<void> {
    if (this.db === undefined) {
      return;
    }
    const myGen = (this.reloadTokens.get(blockId) ?? 0) + 1;
    this.reloadTokens.set(blockId, myGen);
    const bucketMap = await loadRawTradesFromDb(this.db, blockId);
    if (bucketMap === undefined) {
      return;
    }
    if (this.reloadTokens.get(blockId) !== myGen) {
      return;
    }
    runInAction(() => {
      this.recentBucketRawTrades.set(blockId, bucketMap);
      this.recentBlockOrder.add(blockId);
    });
  }

  selectBucketAt(pointer: ITradeHitTestPointer): void {
    const candidates = findBucketsAt(
      pointer,
      this.chartState.tradesIndex,
      this.chartState.getTradesLayerLastFrameStats(),
      this.blockData
    );
    const hit = pickMostRecentBucket(candidates);
    if (hit === undefined) {
      if (this.pinnedBucket !== undefined) {
        this.pinnedBucket = undefined;
      }
      return;
    }
    if (this.pinnedBucket?.bucketStartMs === hit.bucketStartMs) {
      this.pinnedBucket = undefined;
      return;
    }
    this.pinnedBucket = hit;
  }

  /**
   * Hover hit-test with two layered rules (see {@link findBucketsAt}):
   *   - **Sticky** — if the cursor is still inside the currently
   *     hovered bucket's hit-zone, do nothing. The hover stays put
   *     until the cursor leaves that specific circle, even if other
   *     overlapping circles' zones cover the pointer too.
   *   - **Most-recent wins** — when the sticky bucket is no longer a
   *     candidate (or there was no prior hover), pick the candidate
   *     with the greatest `bucketStartMs`. This matches the renderer's
   *     z-lift policy so the visually-on-top circle is always the
   *     interactive one.
   */
  setHoveredBucketAt(pointer: ITradeHitTestPointer): void {
    const candidates = findBucketsAt(
      pointer,
      this.chartState.tradesIndex,
      this.chartState.getTradesLayerLastFrameStats(),
      this.blockData
    );
    const currentHover = this.hoveredBucketKey;
    if (
      currentHover !== undefined &&
      candidates.some(candidate => candidate.bucketStartMs === currentHover)
    ) {
      return;
    }
    const hit = pickMostRecentBucket(candidates);
    const newKey = hit?.bucketStartMs;
    if (newKey !== this.hoveredBucketKey) {
      this.hoveredBucketKey = newKey;
    }
  }

  clearPinnedBucket(): void {
    this.pinnedBucket = undefined;
  }

  clearHoveredBucket(): void {
    this.hoveredBucketKey = undefined;
  }

  /**
   * Computed snapshot of the currently hovered bucket reconstructed from
   * the texture-side `Float32Array` cache. Used by the hover pill to
   * render aggregates without re-doing the linear scan in the component.
   */
  get hoveredBucket(): ITradeBucket | undefined {
    if (this.hoveredBucketKey === undefined) {
      return undefined;
    }
    return decodeBucketAt(this.hoveredBucketKey, this.chartState.tradesIndex, this.blockData);
  }

  private handleTradeBatch(batch: readonly ITrade[]): void {
    // Gating — drop trades arriving before the first orderbook
    // snapshot. Without that anchor the trade-block timeDelta encoding
    // resolves to an undefined coordinate frame.
    if (!this.gate.hasFirstOrderbookSnapshot) {
      return;
    }
    if (this.tradesConnection !== 'connected') {
      this.tradesConnection = 'connected';
    }
    this.tradesReceivedCount += batch.length;
    // Trade-event timestamps inside a single batch are monotonically
    // non-decreasing, so the last entry's `eventTimeMs` is the freshest
    // observation. Using batch[length-1] avoids a per-trade max scan.
    const newest = batch[batch.length - 1]?.eventTimeMs;
    if (newest !== undefined) {
      this.lastTradeTimeMs = newest;
    }
    if (this.accumulator === undefined) {
      return;
    }
    for (const trade of batch) {
      this.accumulator.addTrade(trade);
    }
  }

  private handleFlush(event: ITradeBlockFlushEvent): void {
    this.chartState.ingestTradesFlush(event);
    this.blockData.set(event.block.blockId, event.data);

    const bucketRawMap = new Map(event.rawTradesByBucket);
    this.recentBucketRawTrades.set(event.block.blockId, bucketRawMap);
    // `Set.add` is idempotent and preserves insertion order — re-
    // inserting an existing key does NOT bump it to the end (per JS
    // spec), which matches the original FIFO semantics here: a block
    // gets enqueued exactly once on its first flush and stays in
    // place until cap-trim or `enforceTradesHistoryCap` evicts it.
    this.recentBlockOrder.add(event.block.blockId);
    while (this.recentBlockOrder.size > MAX_RAW_TRADES_BLOCKS_IN_RAM) {
      const oldest: UnixTimeMs | undefined = this.recentBlockOrder.values().next().value;
      if (oldest === undefined) {
        break;
      }
      this.recentBlockOrder.delete(oldest);
      this.recentBucketRawTrades.delete(oldest);
    }

    if (event.isNewBlock) {
      this.enforceTradesHistoryCap();
    }

    // Aggregates are written on every flush; raw-trade dumps only on block
    // rotation, so the whole-block payload is stored exactly once per block.
    //
    // Raw trades must be persisted from the `closedByRotation` event —
    // the block that was just *sealed*, carrying its full
    // `rawTradesByBucket`. The `isNewBlock=true` event carries the fresh
    // EMPTY block, so persisting on it stored empty arrays and left
    // evicted blocks with no recoverable trade history (popup empty).
    if (this.db !== undefined) {
      void persistAggregateBlock(this.db, event);
      if (event.closedByRotation) {
        void persistRawTrades(this.db, event);
      }
    }
  }

  private enforceTradesHistoryCap(): void {
    const tradesIndex = this.chartState.tradesIndex;
    while (tradesIndex.size > MAX_TRADE_BLOCKS_IN_RAM) {
      const oldestStartMs = tradesIndex.oldestStartMs();
      if (oldestStartMs === undefined) {
        break;
      }
      const item = tradesIndex.findByBlockId(oldestStartMs);
      if (item === undefined) {
        break;
      }
      this.chartState.releaseTradesBlockSlot(item.blockId);
      this.blockData.delete(item.blockId);
      this.recentBucketRawTrades.delete(item.blockId);
      this.recentBlockOrder.delete(item.blockId);
      void this.db?.trades.deleteBlock(item.blockId).catch(() => undefined);
      void this.db?.trades.deleteRawTrades(item.blockId).catch(() => undefined);
    }
  }

  private handleStreamError(error: unknown): void {
    runInAction(() => {
      this.tradesConnection = 'error';
      this.tradesErrorMessage = error instanceof Error ? error.message : String(error);
    });
  }
}
