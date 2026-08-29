import { nowEpochMs } from '@frozik/utils/date/now';
import { makeAutoObservable, runInAction } from 'mobx';
import type { IBinanceDb } from '../domain/binance-db';
import { BINANCE_CONFIG } from '../domain/config';
import { SNAPSHOT_SLOTS } from '../domain/constants';
import { DataController } from '../domain/data-controller';
import { DEFAULT_INSTRUMENT, findInstrument, instrumentDbName } from '../domain/instruments';
import type { ConnectionState, IHitTestResult, UnixTimeMs } from '../domain/types';
import { openBinanceDbWithQuotaRecovery } from '../infrastructure/binance-indexeddb-recovery';
import { TaskManager } from '../infrastructure/task-manager';
import { BinanceChartState } from './chart-state';

import { MidPriceStreamStore } from './MidPriceStreamStore';
import { OrderbookStreamStore } from './OrderbookStreamStore';
import { TradesStreamStore } from './TradesStreamStore';

/** Everything a single {@link BinanceViewStore.attachCanvas} run creates. */
interface IAttachedPipeline {
  readonly tradesStore: TradesStreamStore;
  readonly orderbookStore: OrderbookStreamStore;
  readonly midPriceStore: MidPriceStreamStore;
  readonly state: BinanceChartState;
  readonly taskManager: TaskManager;
  readonly dataController: DataController;
  readonly db: IBinanceDb | undefined;
}

/**
 * Slim orchestrator for the binance-view feature. Owns the
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

  /** Set when {@link attachCanvas} rejects before any orderbook sub-store exists, so {@link connection} reports `'unsupported'` instead of hanging on `'connecting'`. */
  private attachFailed = false;

  /** Currently selected instrument symbol (observable — drives the UI selector). */
  instrument: string = DEFAULT_INSTRUMENT.symbol;

  /**
   * The canvas handed to {@link attachCanvas}. Retained so {@link setInstrument}
   * can tear the pipeline down and re-attach the SAME canvas under a new
   * instrument without the presentation layer re-mounting.
   */
  private currentCanvas: HTMLCanvasElement | undefined = undefined;

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

  private get aggregationQuoteStep(): number {
    return findInstrument(this.instrument).aggregationQuoteStep;
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
    if (this.attachFailed && this.orderbookStoreInternal === undefined) {
      return 'unsupported';
    }
    return this.orderbookStoreInternal?.connection ?? 'idle';
  }

  markUnsupported(): void {
    this.attachFailed = true;
    this.orderbookStoreInternal?.markUnsupported();
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
    this.currentCanvas = canvas;
    const token = this.attachToken;

    const db = await openBinanceDbWithQuotaRecovery(instrumentDbName(this.instrument));

    // `dispose()` bumped the token while we were opening IDB — abandon
    // this init so we don't leak a renderer onto a disposed store.
    if (token !== this.attachToken) {
      db?.close();
      return;
    }

    const pipeline = this.buildPipeline(canvas, db);
    const { state, taskManager, dataController, orderbookStore, midPriceStore, tradesStore } =
      pipeline;

    // `BinanceChartRenderer.create` can reject outright (e.g. Safari's Metal back-end
    // rejects pipeline creation rather than returning null); treat it like `ok === false`
    // so the failure surfaces as `'unsupported'` instead of escaping as an unhandled rejection.
    let ok = false;
    try {
      ok = await state.init({ taskManager, dataController });
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: surfaces WebGPU init failure
      console.warn('binance-view: WebGPU renderer init failed, marking unsupported', error);
      ok = false;
    }

    if (!ok) {
      orderbookStore.markUnsupported();
      // Promote into the public slot so the status overlay reflects
      // the `'unsupported'` state — but tear down everything else
      // (the renderer never came up). The orderbook store has nothing
      // to dispose besides its accumulator (not yet created), so its
      // `dispose()` is a no-op here apart from resetting fields.
      this.tearDownPipeline(pipeline, { keepOrderbookStore: true });
      runInAction(() => {
        this.orderbookStoreInternal = orderbookStore;
      });
      return;
    }

    // Token could have been bumped while we awaited WebGPU device +
    // pipeline creation. Throw the fresh renderer away immediately.
    if (token !== this.attachToken) {
      this.tearDownPipeline(pipeline, { keepOrderbookStore: false });
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

  /**
   * Construct the per-attach collaborator graph. Nothing is published into
   * the store's public slots here — the caller decides that once the
   * renderer reports whether WebGPU actually came up.
   */
  private buildPipeline(canvas: HTMLCanvasElement, db: IBinanceDb | undefined): IAttachedPipeline {
    const state = new BinanceChartState({
      canvas,
      pageOpenTimeMs: nowEpochMs() as UnixTimeMs,
      updateSpeedMs: BINANCE_CONFIG.updateSpeedMs,
      // The heatmap cell height is the aggregation bin size, not the
      // raw tickSize — rendering at $0.01 would collapse each row into
      // a single sub-pixel strip. Sub-stores keep `priceStep` for
      // diagnostics only.
      priceStep: this.aggregationQuoteStep,
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
      instrument: this.instrument,
      aggregationQuoteStep: this.aggregationQuoteStep,
      updateSpeedMs: BINANCE_CONFIG.updateSpeedMs,
      onQuantizedSnapshot: midPriceStore.ingestOrderbookSnapshot,
    });
    orderbookStoreRef = orderbookStore;

    const tradesStore = new TradesStreamStore({
      chartState: state,
      db,
      instrument: this.instrument,
      gate: orderbookStore,
    });

    return { tradesStore, orderbookStore, midPriceStore, state, taskManager, dataController, db };
  }

  /**
   * Tear down everything {@link buildPipeline} created, in the same LIFO
   * order as {@link dispose}: trades first (its gate reads orderbook
   * state), then mid-price (consumer of orderbook snapshots), then
   * orderbook (subscription owner), then the shared infra.
   * `keepOrderbookStore` is set when the caller promotes that sub-store
   * into the public slot instead of discarding it.
   */
  private tearDownPipeline(
    pipeline: IAttachedPipeline,
    { keepOrderbookStore }: { readonly keepOrderbookStore: boolean }
  ): void {
    pipeline.tradesStore.dispose();
    if (!keepOrderbookStore) {
      pipeline.orderbookStore.dispose();
    }
    pipeline.midPriceStore.dispose();
    pipeline.state.dispose();
    pipeline.taskManager.dispose();
    pipeline.dataController.dispose();
    pipeline.db?.close();
  }

  startStream(): void {
    this.orderbookStoreInternal?.startStream();
    this.midPriceStoreInternal?.startStream();
    this.tradesStoreInternal?.startStream();
  }

  async setInstrument(symbol: string): Promise<void> {
    if (symbol === this.instrument) {
      return;
    }
    const canvas = this.currentCanvas;
    this.dispose();
    runInAction(() => {
      this.instrument = symbol;
    });
    if (canvas === undefined) {
      return;
    }
    await this.attachCanvas(canvas);
    this.startStream();
  }

  async resolveCellAt(pointerPx: { x: number; y: number }): Promise<void> {
    // `chartState === undefined` means init failed (e.g. Safari WebGPU
    // pipeline rejection): the orderbook sub-store exists so the badge
    // can surface `'unsupported'`, but its hit-test path reads
    // `chartState.viewport` which throws before init. Skip silently.
    if (this.chartState === undefined || this.orderbookStoreInternal === undefined) {
      return;
    }
    await this.orderbookStoreInternal.resolveCellAt(pointerPx);
  }

  clearSelectedCell(): void {
    this.orderbookStoreInternal?.clearSelectedCell();
  }

  dispose(): void {
    this.attachToken++;
    this.attachFailed = false;
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
