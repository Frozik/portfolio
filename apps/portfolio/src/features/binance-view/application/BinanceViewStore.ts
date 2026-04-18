import { nowEpochMs } from '@frozik/utils';
import { makeAutoObservable, runInAction } from 'mobx';
import type { Subscription } from 'rxjs';

import { BinanceChartState } from '../domain/chart-state';
import { BINANCE_CONFIG } from '../domain/config';
import {
  MAX_HISTORY_BLOCKS,
  MAX_MID_PRICE_BLOCKS,
  MID_PRICE_FLUSH_EVERY_SAMPLES,
  MID_PRICE_SAMPLES_PER_BLOCK,
  SNAPSHOT_SLOTS,
} from '../domain/constants';
import { DataController } from '../domain/data-controller';
import { getMidPrice } from '../domain/get-mid-price';
import { plotWidthCssPx } from '../domain/math';
import { TaskManager } from '../domain/task-manager';
import type {
  ConnectionState,
  IHitTestResult,
  IQuantizedSnapshot,
  UnixTimeMs,
} from '../domain/types';
import type { IBinanceDb, IOrderbookBlockRecord } from '../infrastructure/binance-indexeddb';
import { openBinanceDb } from '../infrastructure/binance-indexeddb';
import type { IBlockFlushEvent } from '../infrastructure/block-accumulator';
import { BlockAccumulator } from '../infrastructure/block-accumulator';
import { fetchPriceStep } from '../infrastructure/exchange-info';
import type { IMidPriceFlushEvent } from '../infrastructure/mid-price-block-accumulator';
import { MidPriceBlockAccumulator } from '../infrastructure/mid-price-block-accumulator';
import { liveOrderBook$ } from '../infrastructure/orderbook-stream';

/**
 * Consecutive interpolated/empty snapshots after which the store flips
 * the connection indicator to `'disconnected'`. Matches the quantizer
 * cap — once we've exhausted the repeat-last fills we know no live
 * data has arrived for `MAX_INTERPOLATED_SNAPSHOTS` seconds.
 */
const DISCONNECT_STREAK_THRESHOLD = 5;

export class BinanceViewStore {
  connection: ConnectionState = 'idle';
  snapshotsReceived = 0;
  lastDisplaySnapshotTimeMs: UnixTimeMs | undefined = undefined;
  blocksPersisted = 0;
  priceStep: number | undefined = undefined;
  errorMessage: string | undefined = undefined;
  selectedCell: IHitTestResult | undefined = undefined;
  private interpolatedStreak = 0;

  private subscription: Subscription | undefined = undefined;
  private accumulator: BlockAccumulator | undefined = undefined;
  private midPriceAccumulator: MidPriceBlockAccumulator | undefined = undefined;
  private chartState: BinanceChartState | undefined = undefined;
  private db: IBinanceDb | undefined = undefined;
  private taskManager: TaskManager | undefined = undefined;
  private dataController: DataController | undefined = undefined;
  private pageHideHandler: (() => void) | undefined = undefined;
  /**
   * Monotonic counter bumped on every new `resolveCellAt` call (and on
   * `clearSelectedCell`). Hover fires many async IDB lookups in flight;
   * only the most recent one is allowed to commit to `selectedCell`,
   * so a slower stale lookup can't overwrite a fresher result.
   */
  private hitTestToken = 0;
  /**
   * Monotonic counter bumped on every `dispose()`. An in-flight
   * `attachCanvas` captures this token at entry and aborts if it no
   * longer matches — this prevents React StrictMode's double-mount
   * from leaving two renderers stuck on the same canvas.
   */
  private attachToken = 0;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /**
   * Wire the canvas to a new chart-state, open IndexedDB (clearing any
   * leftover blocks), and start the WebGPU renderer. Must be called
   * before `startStream`.
   */
  async attachCanvas(canvas: HTMLCanvasElement): Promise<void> {
    if (this.chartState !== undefined) {
      return;
    }
    const token = this.attachToken;

    let db: IBinanceDb | undefined;
    try {
      db = await openBinanceDb();
      await db.clearAll();
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: surfaces silent IndexedDB failure (private mode, quota)
      console.warn('binance-view: IndexedDB unavailable, history will not persist', error);
      db = undefined;
    }

    // `dispose()` bumped the token while we were opening IDB — abandon
    // this init so we don't leak a renderer onto a disposed store.
    if (token !== this.attachToken) {
      db?.close();
      return;
    }

    const pageOpenTimeMs = nowEpochMs() as UnixTimeMs;

    const state = new BinanceChartState({
      canvas,
      pageOpenTimeMs,
      updateSpeedMs: BINANCE_CONFIG.updateSpeedMs,
      // The heatmap cell height is the aggregation bin size, not the
      // raw tickSize — rendering at $0.01 would collapse each row into
      // a single sub-pixel strip. We keep `priceStep` in the store for
      // diagnostics only.
      priceStep: BINANCE_CONFIG.aggregationQuoteStep,
    });

    const taskManager = new TaskManager();
    const dataController = new DataController({
      registry: state.registry,
      db: db?.orderbook,
      // Lazy getter: the accumulator is created later in `startStream`,
      // and may be swapped on reconnect scenarios without the
      // controller needing to know.
      getActiveBlock: () => this.accumulator?.getActiveBlock() ?? null,
      updateSpeedMs: BINANCE_CONFIG.updateSpeedMs,
      depth: BINANCE_CONFIG.aggregatedDepth,
      snapshotSlots: SNAPSHOT_SLOTS,
    });

    const ok = await state.init({ taskManager, dataController });
    if (!ok) {
      runInAction(() => {
        this.connection = 'unsupported';
      });
      state.dispose();
      taskManager.dispose();
      dataController.dispose();
      db?.close();
      return;
    }

    // Token could have been bumped while we awaited WebGPU device +
    // pipeline creation. Throw the fresh renderer away immediately.
    if (token !== this.attachToken) {
      state.dispose();
      taskManager.dispose();
      dataController.dispose();
      db?.close();
      return;
    }

    const pageHideHandler = (): void => {
      // Fire-and-forget: if the transaction doesn't complete before
      // unload, the next attach() call will re-issue clearAll() at
      // startup anyway.
      void this.db?.clearAll();
    };

    // All five assignments land after an `await` — outside the
    // synchronous span of the auto-bound action, so MobX strict mode
    // rejects them unless wrapped. The handler itself is declared
    // above as a local so `addEventListener` after the block has a
    // non-nullable reference even after TS loses narrowing across
    // the `runInAction` callback boundary.
    runInAction(() => {
      this.db = db;
      this.chartState = state;
      this.taskManager = taskManager;
      this.dataController = dataController;
      this.pageHideHandler = pageHideHandler;
    });
    window.addEventListener('pagehide', pageHideHandler);
  }

  startStream(): void {
    if (this.subscription !== undefined || this.connection === 'unsupported') {
      return;
    }

    this.connection = 'connecting';
    this.errorMessage = undefined;

    void this.loadPriceStep();

    this.accumulator = new BlockAccumulator({
      snapshotsPerBlock: BINANCE_CONFIG.snapshotsPerBlock,
      flushEverySnapshots: BINANCE_CONFIG.flushEverySnapshots,
      snapshotSlots: SNAPSHOT_SLOTS,
      depth: BINANCE_CONFIG.aggregatedDepth,
      updateSpeedMs: BINANCE_CONFIG.updateSpeedMs,
      onFlush: this.handleFlush,
    });

    this.midPriceAccumulator = new MidPriceBlockAccumulator({
      samplesPerBlock: MID_PRICE_SAMPLES_PER_BLOCK,
      updateSpeedMs: BINANCE_CONFIG.updateSpeedMs,
      flushEverySamples: MID_PRICE_FLUSH_EVERY_SAMPLES,
      onFlush: this.handleMidPriceFlush,
    });

    this.subscription = liveOrderBook$({
      streamHost: BINANCE_CONFIG.streamHost,
      apiHost: BINANCE_CONFIG.apiHost,
      instrument: BINANCE_CONFIG.instrument,
      depth: BINANCE_CONFIG.rawDepth,
      updateSpeedMs: BINANCE_CONFIG.updateSpeedMs,
      restSnapshotLimit: BINANCE_CONFIG.restSnapshotLimit,
      aggregationQuoteStep: BINANCE_CONFIG.aggregationQuoteStep,
      reconnectDelayMs: BINANCE_CONFIG.reconnectDelayMs,
      maxSequenceGapRetries: BINANCE_CONFIG.maxSequenceGapRetries,
    }).subscribe({
      next: this.handleSnapshot,
      error: this.handleError,
    });
  }

  dispose(): void {
    this.attachToken++;
    if (this.pageHideHandler !== undefined) {
      window.removeEventListener('pagehide', this.pageHideHandler);
      this.pageHideHandler = undefined;
    }
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    // ChartState disposes ViewportController, which in turn unsubscribes
    // from TaskManager — so dispose the chart first, then tear down the
    // shared scheduler and the data source.
    this.chartState?.dispose();
    this.chartState = undefined;
    this.taskManager?.dispose();
    this.taskManager = undefined;
    this.dataController?.dispose();
    this.dataController = undefined;
    this.accumulator?.dispose();
    this.accumulator = undefined;
    this.midPriceAccumulator?.dispose();
    this.midPriceAccumulator = undefined;
    if (this.db !== undefined) {
      const db = this.db;
      this.db = undefined;
      void db.clearAll().finally(() => db.close());
    }
    this.connection = 'idle';
    this.snapshotsReceived = 0;
    this.interpolatedStreak = 0;
    this.lastDisplaySnapshotTimeMs = undefined;
    this.selectedCell = undefined;
  }

  async resolveCellAt(pointerPx: { x: number; y: number }): Promise<void> {
    if (this.chartState === undefined || this.dataController === undefined) {
      return;
    }
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

  private async loadPriceStep(): Promise<void> {
    // Kept for the status overlay — the renderer itself uses
    // `aggregationQuoteStep` as the effective cell step, so we just
    // record the raw tickSize here without propagating it to the
    // chart state.
    const fetched = await fetchPriceStep(BINANCE_CONFIG.apiHost, BINANCE_CONFIG.instrument);
    runInAction(() => {
      this.priceStep = fetched ?? BINANCE_CONFIG.fallbackPriceStep;
    });
  }

  private handleSnapshot(snapshot: IQuantizedSnapshot): void {
    this.snapshotsReceived++;
    if (snapshot.isInterpolated) {
      this.interpolatedStreak += 1;
      this.connection =
        this.interpolatedStreak >= DISCONNECT_STREAK_THRESHOLD ? 'disconnected' : 'connected';
    } else {
      this.interpolatedStreak = 0;
      this.connection = 'connected';
    }
    this.accumulator?.addSnapshot(snapshot);

    const midPrice = getMidPrice(snapshot);
    if (midPrice !== undefined) {
      this.midPriceAccumulator?.addSample({
        eventTimeMs: snapshot.eventTimeMs,
        price: midPrice,
      });
    }
  }

  private handleFlush(event: IBlockFlushEvent): void {
    this.chartState?.ingestFlush(event);

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
      if (event.isNewBlock) {
        runInAction(() => {
          this.blocksPersisted++;
        });
      }
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: surfaces quota-exceeded / write failure
      console.warn('binance-view: IndexedDB putBlock failed', error);
    }
  }

  private enforceHistoryCap(): void {
    if (this.chartState === undefined) {
      return;
    }
    const registry = this.chartState.registry;
    while (registry.size > MAX_HISTORY_BLOCKS) {
      const oldestMs = registry.oldestStartMs();
      if (oldestMs === undefined) {
        break;
      }
      const item = registry.get(oldestMs);
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

  private handleMidPriceFlush(event: IMidPriceFlushEvent): void {
    this.chartState?.ingestMidPriceFlush(event);
    void this.persistMidPriceBlock(event);
    if (event.isNewBlock) {
      this.enforceMidPriceHistoryCap();
    }
  }

  private async persistMidPriceBlock(event: IMidPriceFlushEvent): Promise<void> {
    if (this.db === undefined) {
      return;
    }
    const dataCopy = new ArrayBuffer(event.data.byteLength);
    new Uint8Array(dataCopy).set(
      new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength)
    );
    try {
      await this.db.midPrice.putBlock({
        blockId: event.block.blockId,
        firstTimestampMs: event.block.firstTimestampMs,
        lastTimestampMs: event.block.lastTimestampMs,
        basePrice: event.block.basePrice,
        count: event.block.count,
        textureRowIndex: event.block.textureRowIndex,
        data: dataCopy,
      });
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: surfaces quota-exceeded / write failure for mid-price
      console.warn('binance-view: IndexedDB mid-price putBlock failed', error);
    }
  }

  private enforceMidPriceHistoryCap(): void {
    if (this.chartState === undefined) {
      return;
    }
    const index = this.chartState.midPriceIndex;
    while (index.size > MAX_MID_PRICE_BLOCKS) {
      const oldestMs = index.oldestStartMs();
      if (oldestMs === undefined) {
        break;
      }
      const item = index.get(oldestMs);
      if (item === undefined) {
        break;
      }
      index.remove(oldestMs);
      this.chartState.releaseMidPriceBlockSlot(item.blockId);
      void this.db?.midPrice.deleteBlock(item.blockId).catch(() => {
        // ignore individual deletion failures; pagehide will wipe the DB.
      });
    }
  }
}
