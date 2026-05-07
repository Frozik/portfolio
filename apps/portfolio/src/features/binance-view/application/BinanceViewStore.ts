import { nowEpochMs } from '@frozik/utils/date/now';
import { makeAutoObservable, runInAction } from 'mobx';

import { BinanceChartState } from '../domain/chart-state';
import { BINANCE_CONFIG } from '../domain/config';
import { SNAPSHOT_SLOTS } from '../domain/constants';
import { DataController } from '../domain/data-controller';
import { TaskManager } from '../domain/task-manager';
import type { ConnectionState, IHitTestResult, UnixTimeMs } from '../domain/types';
import type { IBinanceDb } from '../infrastructure/binance-indexeddb';
import { DEFAULT_DB_NAME, openBinanceDb } from '../infrastructure/binance-indexeddb';

import { MidPriceStreamStore } from './MidPriceStreamStore';
import { OrderbookStreamStore } from './OrderbookStreamStore';
import { TradesStreamStore } from './TradesStreamStore';

/**
 * Slim orchestrator for the binance-view feature (§2.11). Owns the
 * canvas-bound infrastructure shared by every per-stream sub-store —
 * `chartState`, the IndexedDB connection, the `TaskManager`
 * scheduler, the `DataController` LRU cache, and the `pagehide`
 * handler — and delegates per-stream observable state (connection,
 * accumulators, hit-test results) to {@link OrderbookStreamStore} and
 * {@link MidPriceStreamStore}.
 *
 * Public surface (`connection`, `snapshotsReceived`,
 * `lastDisplaySnapshotTimeMs`, `errorMessage`, `selectedCell`,
 * `resolveCellAt`, `clearSelectedCell`) is intentionally preserved as
 * thin proxies onto the orderbook sub-store so existing presentation
 * components don't need to know about the split.
 */
export class BinanceViewStore {
  private chartState: BinanceChartState | undefined = undefined;
  private db: IBinanceDb | undefined = undefined;
  private taskManager: TaskManager | undefined = undefined;
  private dataController: DataController | undefined = undefined;
  private pageHideHandler: (() => void) | undefined = undefined;
  private orderbookStoreInternal: OrderbookStreamStore | undefined = undefined;
  private midPriceStoreInternal: MidPriceStreamStore | undefined = undefined;
  private tradesStoreInternal: TradesStreamStore | undefined = undefined;

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

  get orderbookStore(): OrderbookStreamStore | undefined {
    return this.orderbookStoreInternal;
  }

  get midPriceStore(): MidPriceStreamStore | undefined {
    return this.midPriceStoreInternal;
  }

  get tradesStore(): TradesStreamStore | undefined {
    return this.tradesStoreInternal;
  }

  /**
   * Public read-only handle for the live chart-state. Exposed so the
   * presentation layer can build a hit-test pointer descriptor for the
   * trades hover/click handlers (see
   * `presentation/build-trade-hit-test-pointer.ts`). Returns
   * `undefined` until {@link attachCanvas} resolves.
   */
  get chartStateView(): BinanceChartState | undefined {
    return this.chartState;
  }

  get connection(): ConnectionState {
    return this.orderbookStoreInternal?.connection ?? 'idle';
  }

  get snapshotsReceived(): number {
    return this.orderbookStoreInternal?.snapshotsReceived ?? 0;
  }

  get lastDisplaySnapshotTimeMs(): UnixTimeMs | undefined {
    return this.orderbookStoreInternal?.lastDisplaySnapshotTimeMs;
  }

  get errorMessage(): string | undefined {
    return this.orderbookStoreInternal?.errorMessage;
  }

  get selectedCell(): IHitTestResult | undefined {
    return this.orderbookStoreInternal?.selectedCell;
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
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        // biome-ignore lint/suspicious/noConsole: surfaces quota recovery
        console.warn('binance-view: IDB quota exceeded, deleting database for fresh start');
        db?.close();
        try {
          await new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase(DEFAULT_DB_NAME);
            request.onsuccess = (): void => resolve();
            request.onerror = (): void =>
              reject(request.error ?? new Error('deleteDatabase failed'));
            // Best-effort: another tab is holding the DB open. Proceed
            // anyway — `openBinanceDb` will block until the other tab
            // closes the connection, and on success we end up with a
            // freshly-open DB that's already past the quota wall.
            request.onblocked = (): void => resolve();
          });
          db = await openBinanceDb();
        } catch (recoveryError) {
          // biome-ignore lint/suspicious/noConsole: surfaces unrecoverable IDB failure
          console.warn('binance-view: IDB recovery failed, persistence disabled', recoveryError);
          db = undefined;
        }
      } else {
        // biome-ignore lint/suspicious/noConsole: surfaces silent IndexedDB failure (private mode, quota)
        console.warn('binance-view: IndexedDB unavailable, history will not persist', error);
        db = undefined;
      }
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
      // a single sub-pixel strip. Sub-stores keep `priceStep` for
      // diagnostics only.
      priceStep: BINANCE_CONFIG.aggregationQuoteStep,
    });

    const taskManager = new TaskManager();

    // mid-price first: it has no upstream dependencies and is captured
    // by `onQuantizedSnapshot` below. Constructing it first keeps the
    // orderbook fan-out closure simple (no `let`/forward-decl dance).
    const midPriceStore = new MidPriceStreamStore({
      chartState: state,
      db,
      updateSpeedMs: BINANCE_CONFIG.updateSpeedMs,
    });

    // The active-block closure resolves through `orderbookStore` once
    // it's constructed below; until then it returns `null`, which
    // matches the pre-split contract (no in-flight block before
    // `startStream`).
    let orderbookStoreRef: OrderbookStreamStore | undefined;
    const dataController = new DataController({
      registry: state.registry,
      db: db?.orderbook,
      getActiveBlock: () => orderbookStoreRef?.getActiveBlock() ?? null,
      updateSpeedMs: BINANCE_CONFIG.updateSpeedMs,
      depth: BINANCE_CONFIG.aggregatedDepth,
      snapshotSlots: SNAPSHOT_SLOTS,
    });

    const orderbookStore = new OrderbookStreamStore({
      chartState: state,
      dataController,
      db,
      instrument: BINANCE_CONFIG.instrument,
      updateSpeedMs: BINANCE_CONFIG.updateSpeedMs,
      onQuantizedSnapshot: midPriceStore.ingestOrderbookSnapshot,
    });
    orderbookStoreRef = orderbookStore;

    const tradesStore = new TradesStreamStore({
      chartState: state,
      db,
      instrument: BINANCE_CONFIG.instrument,
      gate: orderbookStore,
    });

    const ok = await state.init({ taskManager, dataController });
    if (!ok) {
      orderbookStore.markUnsupported();
      // Promote into the public slot so the status overlay reflects
      // the `'unsupported'` state — but tear down everything else
      // (the renderer never came up). The orderbook store has nothing
      // to dispose besides its accumulator (not yet created), so its
      // `dispose()` is a no-op here apart from resetting fields.
      tradesStore.dispose();
      midPriceStore.dispose();
      state.dispose();
      taskManager.dispose();
      dataController.dispose();
      db?.close();
      runInAction(() => {
        this.orderbookStoreInternal = orderbookStore;
      });
      return;
    }

    // Token could have been bumped while we awaited WebGPU device +
    // pipeline creation. Throw the fresh renderer away immediately.
    if (token !== this.attachToken) {
      tradesStore.dispose();
      orderbookStore.dispose();
      midPriceStore.dispose();
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

    // Wire the trades store handle into the chart-state so the trades
    // layer can observe `hoveredBucketKey` per frame. Done before the
    // `runInAction` block to keep the renderer's `tradesStoreView`
    // ref consistent with the public slot we're about to publish.
    state.setTradesStore(tradesStore);

    // All assignments land after an `await` — outside the synchronous
    // span of the auto-bound action, so MobX strict mode rejects them
    // unless wrapped.
    runInAction(() => {
      this.db = db;
      this.chartState = state;
      this.taskManager = taskManager;
      this.dataController = dataController;
      this.pageHideHandler = pageHideHandler;
      this.orderbookStoreInternal = orderbookStore;
      this.midPriceStoreInternal = midPriceStore;
      this.tradesStoreInternal = tradesStore;
    });
    window.addEventListener('pagehide', pageHideHandler);
  }

  startStream(): void {
    this.orderbookStoreInternal?.startStream();
    this.midPriceStoreInternal?.startStream();
    this.tradesStoreInternal?.startStream();
  }

  async resolveCellAt(pointerPx: { x: number; y: number }): Promise<void> {
    if (this.orderbookStoreInternal === undefined) {
      return;
    }
    await this.orderbookStoreInternal.resolveCellAt(pointerPx);
  }

  clearSelectedCell(): void {
    this.orderbookStoreInternal?.clearSelectedCell();
  }

  dispose(): void {
    this.attachToken++;
    if (this.pageHideHandler !== undefined) {
      window.removeEventListener('pagehide', this.pageHideHandler);
      this.pageHideHandler = undefined;
    }
    // LIFO sub-store teardown: trades first (its gate reads
    // orderbook state), then mid-price (consumer of orderbook
    // snapshots), then orderbook (subscription owner). Orchestrator-
    // owned shared infra (chart-state, task-manager, data-controller)
    // tears down after — chart-state disposes ViewportController,
    // which unsubscribes from TaskManager, so order matters.
    this.chartState?.setTradesStore(undefined);
    this.tradesStoreInternal?.dispose();
    this.tradesStoreInternal = undefined;
    this.midPriceStoreInternal?.dispose();
    this.midPriceStoreInternal = undefined;
    this.orderbookStoreInternal?.dispose();
    this.orderbookStoreInternal = undefined;
    this.chartState?.dispose();
    this.chartState = undefined;
    this.taskManager?.dispose();
    this.taskManager = undefined;
    this.dataController?.dispose();
    this.dataController = undefined;
    if (this.db !== undefined) {
      const db = this.db;
      this.db = undefined;
      void db.clearAll().finally(() => db.close());
    }
  }
}
