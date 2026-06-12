import type { Milliseconds } from '@frozik/utils/date/types';
import { makeAutoObservable, runInAction } from 'mobx';
import type { Subscription } from 'rxjs';

import type { BinanceChartState } from '../domain/chart-state';
import { BINANCE_CONFIG } from '../domain/config';
import { MAX_HISTORY_BLOCKS, SNAPSHOT_SLOTS } from '../domain/constants';
import type { DataController, IActiveBlockSource } from '../domain/data-controller';
import { plotWidthCssPx } from '../domain/math';
import type {
  ConnectionState,
  IHitTestResult,
  IQuantizedSnapshot,
  UnixTimeMs,
} from '../domain/types';
import type { IBinanceDb, IOrderbookBlockRecord } from '../infrastructure/binance-indexeddb';
import type { IBlockFlushEvent } from '../infrastructure/block-accumulator';
import { BlockAccumulator } from '../infrastructure/block-accumulator';
import { liveOrderBook$ } from '../infrastructure/orderbook-stream';

import type { IOrderbookGate } from './IOrderbookGate';

/**
 * Consecutive interpolated/empty snapshots after which the store flips
 * the connection indicator to `'disconnected'`. Matches the quantizer
 * cap — once we've exhausted the repeat-last fills we know no live
 * data has arrived for `MAX_INTERPOLATED_SNAPSHOTS` seconds.
 */
const DISCONNECT_STREAK_THRESHOLD = 5;

export interface IOrderbookStreamStoreParams {
  readonly chartState: BinanceChartState;
  readonly dataController: DataController;
  readonly db: IBinanceDb | undefined;
  readonly instrument: string;
  readonly updateSpeedMs: Milliseconds;
  /**
   * Fan-out hook fired on every quantized snapshot processed by this
   * store. The orchestrator wires it to {@link MidPriceStreamStore}
   * (and, in step 6, the future trades stream store) — keeps fellow
   * sub-stores oblivious to the orderbook subscription's lifetime.
   *
   * Invoked synchronously inside `handleSnapshot`, after this store
   * has updated its own connection / streak state but before it
   * forwards to the {@link BlockAccumulator}.
   */
  readonly onQuantizedSnapshot?: (snapshot: IQuantizedSnapshot) => void;
}

/**
 * Per-stream sub-store extracted from the legacy `BinanceViewStore`
 * god-store (§2.11). Owns the live orderbook subscription, the block
 * accumulator, hit-test resolution against the shared
 * {@link DataController}, and the connection-state indicators surfaced
 * by the status overlay.
 *
 * Implements {@link IOrderbookGate} so {@link TradesStreamStore} can
 * read the §1.1 gating sentinel without coupling to the rest of the
 * orderbook surface.
 */
export class OrderbookStreamStore implements IOrderbookGate {
  connection: ConnectionState = 'idle';
  snapshotsReceived = 0;
  lastDisplaySnapshotTimeMs: UnixTimeMs | undefined = undefined;
  errorMessage: string | undefined = undefined;
  selectedCell: IHitTestResult | undefined = undefined;
  /**
   * §1.1 gating sentinel — flipped to `true` exactly once when the
   * first depth snapshot is processed in `handleSnapshot`. Stays `true`
   * for the rest of the store's lifetime (incl. across WS reconnects);
   * only `dispose` resets it.
   */
  hasFirstOrderbookSnapshot = false;

  private readonly chartState: BinanceChartState;
  private readonly dataController: DataController;
  private readonly db: IBinanceDb | undefined;
  private readonly instrument: string;
  private readonly updateSpeedMs: Milliseconds;
  private readonly onQuantizedSnapshot: ((snapshot: IQuantizedSnapshot) => void) | undefined;

  private interpolatedStreak = 0;
  private subscription: Subscription | undefined = undefined;
  private accumulator: BlockAccumulator | undefined = undefined;
  /**
   * Monotonic counter bumped on every new `resolveCellAt` call (and on
   * `clearSelectedCell`). Hover fires many async IDB lookups in flight;
   * only the most recent one is allowed to commit to `selectedCell`,
   * so a slower stale lookup can't overwrite a fresher result.
   */
  private hitTestToken = 0;

  constructor(params: IOrderbookStreamStoreParams) {
    this.chartState = params.chartState;
    this.dataController = params.dataController;
    this.db = params.db;
    this.instrument = params.instrument;
    this.updateSpeedMs = params.updateSpeedMs;
    this.onQuantizedSnapshot = params.onQuantizedSnapshot;

    makeAutoObservable(this, {}, { autoBind: true });
  }

  /**
   * Read the currently active in-flight block from the accumulator.
   * The orchestrator-owned {@link DataController} consumes this via a
   * closure so it can fold the in-flight block into hit-test /
   * snapshot resolution before the block is flushed to RAM/IDB.
   *
   * Returns `null` when the store hasn't started streaming yet (no
   * accumulator) or when the accumulator has no in-flight block —
   * matches the pre-split contract.
   */
  getActiveBlock(): IActiveBlockSource | null {
    return this.accumulator?.getActiveBlock() ?? null;
  }

  startStream(): void {
    if (this.subscription !== undefined || this.connection === 'unsupported') {
      return;
    }

    this.connection = 'connecting';
    this.errorMessage = undefined;

    this.accumulator = new BlockAccumulator({
      snapshotsPerBlock: BINANCE_CONFIG.snapshotsPerBlock,
      flushEverySnapshots: BINANCE_CONFIG.flushEverySnapshots,
      snapshotSlots: SNAPSHOT_SLOTS,
      depth: BINANCE_CONFIG.aggregatedDepth,
      updateSpeedMs: this.updateSpeedMs,
      onFlush: this.handleFlush,
    });

    this.subscription = liveOrderBook$({
      streamHost: BINANCE_CONFIG.streamHost,
      apiHost: BINANCE_CONFIG.apiHost,
      instrument: this.instrument,
      depth: BINANCE_CONFIG.rawDepth,
      updateSpeedMs: this.updateSpeedMs,
      restSnapshotLimit: BINANCE_CONFIG.restSnapshotLimit,
      aggregationQuoteStep: BINANCE_CONFIG.aggregationQuoteStep,
      reconnectDelayMs: BINANCE_CONFIG.reconnectDelayMs,
      maxSequenceGapRetries: BINANCE_CONFIG.maxSequenceGapRetries,
    }).subscribe({
      next: this.handleSnapshot,
      error: this.handleError,
    });
  }

  /**
   * Mark the store as `'unsupported'`, mirroring the pre-split
   * behaviour when WebGPU device/pipeline creation fails. The
   * orchestrator calls this from `attachCanvas` after `chartState.init`
   * returns `false`.
   */
  markUnsupported(): void {
    this.connection = 'unsupported';
  }

  async resolveCellAt(pointerPx: { x: number; y: number }): Promise<void> {
    const token = ++this.hitTestToken;
    const result = await this.dataController.resolveCellAt({
      pointerPx,
      plotRect: {
        width: plotWidthCssPx(this.chartState.canvas.clientWidth),
        height: this.chartState.canvas.clientHeight,
      },
      viewport: this.chartState.viewport,
      priceStep: BINANCE_CONFIG.aggregationQuoteStep,
    });
    if (token !== this.hitTestToken) {
      return;
    }
    runInAction(() => {
      this.selectedCell = result ?? undefined;
    });
  }

  clearSelectedCell(): void {
    this.hitTestToken++;
    this.selectedCell = undefined;
  }

  dispose(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    this.accumulator?.dispose();
    this.accumulator = undefined;
    this.connection = 'idle';
    this.snapshotsReceived = 0;
    this.interpolatedStreak = 0;
    this.lastDisplaySnapshotTimeMs = undefined;
    this.selectedCell = undefined;
    this.hasFirstOrderbookSnapshot = false;
  }

  private handleSnapshot(snapshot: IQuantizedSnapshot): void {
    this.snapshotsReceived++;
    if (!this.hasFirstOrderbookSnapshot) {
      this.hasFirstOrderbookSnapshot = true;
    }
    if (snapshot.isInterpolated) {
      this.interpolatedStreak += 1;
      this.connection =
        this.interpolatedStreak >= DISCONNECT_STREAK_THRESHOLD ? 'disconnected' : 'connected';
    } else {
      this.interpolatedStreak = 0;
      this.connection = 'connected';
    }
    this.accumulator?.addSnapshot(snapshot);
    this.onQuantizedSnapshot?.(snapshot);
  }

  private handleFlush(event: IBlockFlushEvent): void {
    this.chartState.ingestFlush(event);

    runInAction(() => {
      this.lastDisplaySnapshotTimeMs = event.block.lastTimestampMs;
    });

    void this.persistFlushedBlock(event);

    if (event.isNewBlock) {
      this.enforceHistoryCap();
    }
  }

  private async persistFlushedBlock(event: IBlockFlushEvent): Promise<void> {
    if (this.db === undefined) {
      return;
    }
    // Copy into a fresh ArrayBuffer so the active block can keep mutating
    // its own buffer without racing with IndexedDB structured clone.
    const dataCopy = new ArrayBuffer(event.data.byteLength);
    new Uint8Array(dataCopy).set(
      new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength)
    );
    const record: IOrderbookBlockRecord = {
      blockId: event.block.blockId,
      firstTimestampMs: event.block.firstTimestampMs,
      lastTimestampMs: event.block.lastTimestampMs,
      count: event.block.count,
      textureRowIndex: event.block.textureRowIndex,
      data: dataCopy,
    };
    try {
      await this.db.orderbook.putBlock(record);
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: surfaces quota-exceeded / write failure
      console.warn('binance-view: IndexedDB putBlock failed', error);
    }
  }

  private enforceHistoryCap(): void {
    const registry = this.chartState.registry;
    while (registry.size > MAX_HISTORY_BLOCKS) {
      const oldestMs = registry.oldestStartMs();
      if (oldestMs === undefined) {
        break;
      }
      const item = registry.findByBlockId(oldestMs);
      if (item === undefined) {
        break;
      }
      registry.remove(oldestMs);
      this.chartState.releaseBlockSlot(item.blockId);
      void this.db?.orderbook.deleteBlock(item.blockId).catch(() => {
        // ignore individual deletion failures; pagehide will wipe the DB.
      });
    }
  }

  private handleError(error: unknown): void {
    this.connection = 'error';
    this.errorMessage = error instanceof Error ? error.message : String(error);
  }
}
