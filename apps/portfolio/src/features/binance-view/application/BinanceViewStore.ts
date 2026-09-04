import { nowEpochMs } from '@frozik/utils/date/now';
import { EValueDescriptorErrorCode } from '@frozik/utils/value-descriptors/codes';
import { Fail } from '@frozik/utils/value-descriptors/fails/fail';
import type { ValueDescriptorFail } from '@frozik/utils/value-descriptors/types';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';
import { deriveAggregationQuoteStep } from '../domain/aggregation-step';
import type { IBinanceDb } from '../domain/binance-db';
import { BINANCE_CONFIG } from '../domain/config';
import { SNAPSHOT_SLOTS } from '../domain/constants';
import { DataController } from '../domain/data-controller';
import type { IInstrument, InstrumentSymbol } from '../domain/instruments';
import { DEFAULT_INSTRUMENT, findCuratedInstrument, instrumentDbName } from '../domain/instruments';
import type { IChartCanvases } from '../domain/ports/chart-renderer';
import type { IInstrumentCatalog } from '../domain/ports/instrument-catalog';
import type { PersistenceState, UnixTimeMs } from '../domain/types';
import type { BinanceDbOpenResult } from '../infrastructure/binance-indexeddb-recovery';
import { TaskManager } from '../infrastructure/task-manager';
import { CandleStreamStore } from './CandleStreamStore';
import type { IChartStateDeps } from './chart-state';
import { BinanceChartState } from './chart-state';
import { OrderbookStreamStore } from './OrderbookStreamStore';
import { PersistenceGate } from './persistence-gate';
import { TradesStreamStore } from './TradesStreamStore';

export interface IBinanceViewStoreDeps extends IChartStateDeps {
  readonly openDb: (dbName: string) => Promise<BinanceDbOpenResult>;
  readonly instrumentCatalog: IInstrumentCatalog;
}

/** Why the chart could not be brought up: the device lacks WebGPU, or the exchange has no such symbol. */
export interface IAttachFailure {
  readonly kind: 'webgpu' | 'instrument';
  readonly reason: ValueDescriptorFail;
}

interface IPipeline {
  readonly db: IBinanceDb | undefined;
  readonly chartState: BinanceChartState;
  readonly taskManager: TaskManager;
  readonly dataController: DataController;
  readonly persistence: PersistenceGate;
  readonly orderbookStore: OrderbookStreamStore;
  readonly candleStore: CandleStreamStore;
  readonly tradesStore: TradesStreamStore;
}

/**
 * Where the canvas attachment stands. `attaching` may be abandoned by a
 * detach while the exchange, IndexedDB or WebGPU is still answering;
 * `failed` keeps the reason for the status badge.
 */
type Attachment =
  | { readonly phase: 'detached' }
  | {
      readonly phase: 'attaching';
      readonly canvases: IChartCanvases;
      readonly abort: AbortController;
    }
  | { readonly phase: 'attached'; readonly canvases: IChartCanvases; readonly pipeline: IPipeline }
  | {
      readonly phase: 'failed';
      readonly canvases: IChartCanvases;
      readonly failure: IAttachFailure;
    };

const PERSISTING: PersistenceState = { status: 'persisting' };

/**
 * Orchestrates the feature: opens IndexedDB, builds the per-stream stores
 * around one chart state, and tears the whole pipeline down on detach or
 * instrument change. Per-stream observable state lives in the sub-stores.
 */
export class BinanceViewStore {
  instrument: InstrumentSymbol = DEFAULT_INSTRUMENT.symbol;
  persistence: PersistenceState = PERSISTING;
  private attachment: Attachment = { phase: 'detached' };

  constructor(private readonly deps: IBinanceViewStoreDeps) {
    makeAutoObservable<BinanceViewStore, 'deps' | 'attachment'>(
      this,
      { deps: false, attachment: observableRef },
      { autoBind: true }
    );
  }

  get chartState(): BinanceChartState | undefined {
    return this.pipeline?.chartState;
  }

  get orderbookStore(): OrderbookStreamStore | undefined {
    return this.pipeline?.orderbookStore;
  }

  get candleStore(): CandleStreamStore | undefined {
    return this.pipeline?.candleStore;
  }

  get tradesStore(): TradesStreamStore | undefined {
    return this.pipeline?.tradesStore;
  }

  get attachFailure(): IAttachFailure | undefined {
    return this.attachment.phase === 'failed' ? this.attachment.failure : undefined;
  }

  /** Binds the canvases, opens the database and starts every stream. Never rejects. */
  async attachCanvas(canvases: IChartCanvases): Promise<void> {
    if (this.attachment.phase !== 'detached') {
      return;
    }
    const abort = new AbortController();
    this.attachment = { phase: 'attaching', canvases, abort };

    const instrument = await this.resolveInstrument(this.instrument);
    if (abort.signal.aborted) {
      return;
    }
    if (!('symbol' in instrument)) {
      runInAction(() => {
        this.attachment = { phase: 'failed', canvases, failure: instrument };
      });
      return;
    }

    const opened = await this.deps.openDb(instrumentDbName(instrument.symbol));
    if (abort.signal.aborted) {
      closeOpened(opened);
      return;
    }
    const db = this.adoptOpenResult(opened);

    const pipeline = this.buildPipeline(canvases, instrument, db);
    const rendererFailure = await pipeline.chartState.init({
      taskManager: pipeline.taskManager,
      dataController: pipeline.dataController,
    });
    if (abort.signal.aborted) {
      tearDownPipeline(pipeline);
      return;
    }
    if (!isNil(rendererFailure)) {
      tearDownPipeline(pipeline);
      runInAction(() => {
        this.attachment = {
          phase: 'failed',
          canvases,
          failure: { kind: 'webgpu', reason: rendererFailure },
        };
      });
      return;
    }

    runInAction(() => {
      this.attachment = { phase: 'attached', canvases, pipeline };
    });
    pipeline.orderbookStore.startStream();
    pipeline.candleStore.startStream();
    pipeline.tradesStore.startStream();
  }

  detachCanvas(): void {
    const attachment = this.attachment;
    this.attachment = { phase: 'detached' };
    this.persistence = PERSISTING;
    switch (attachment.phase) {
      case 'attaching':
        attachment.abort.abort();
        return;
      case 'attached':
        tearDownPipeline(attachment.pipeline);
        return;
      case 'failed':
      case 'detached':
        return;
    }
  }

  async setInstrument(symbol: InstrumentSymbol): Promise<void> {
    if (symbol === this.instrument) {
      return;
    }
    const attachment = this.attachment;
    this.detachCanvas();
    this.instrument = symbol;
    if (attachment.phase !== 'detached') {
      await this.attachCanvas(attachment.canvases);
    }
  }

  dispose(): void {
    this.detachCanvas();
  }

  private get pipeline(): IPipeline | undefined {
    return this.attachment.phase === 'attached' ? this.attachment.pipeline : undefined;
  }

  private adoptOpenResult(opened: BinanceDbOpenResult): IBinanceDb | undefined {
    if (opened.kind === 'opened') {
      return opened.db;
    }
    runInAction(() => {
      this.persistence = { status: 'disabled', reason: opened.reason };
    });
    return undefined;
  }

  private disablePersistence(reason: ValueDescriptorFail): void {
    this.persistence = { status: 'disabled', reason };
  }

  /** Curated symbols carry a hand-tuned step; anything else is asked of the exchange. */
  private async resolveInstrument(symbol: InstrumentSymbol): Promise<IInstrument | IAttachFailure> {
    const curatedInstrument = findCuratedInstrument(symbol);
    if (!isNil(curatedInstrument)) {
      return curatedInstrument;
    }
    const lookup = await this.deps.instrumentCatalog.lookup(symbol);
    switch (lookup.kind) {
      case 'listed':
        return {
          symbol,
          aggregationQuoteStep: deriveAggregationQuoteStep({
            tickSize: lookup.listing.tickSize,
            referencePrice: lookup.listing.lastPrice,
            binsPerSide: BINANCE_CONFIG.aggregatedDepth,
          }),
        };
      case 'unknown':
        return {
          kind: 'instrument',
          reason: Fail(EValueDescriptorErrorCode.NOT_FOUND, {
            message: `${symbol} is not traded on Binance spot`,
          }),
        };
      case 'failed':
        return { kind: 'instrument', reason: lookup.reason };
    }
  }

  private buildPipeline(
    canvases: IChartCanvases,
    instrument: IInstrument,
    db: IBinanceDb | undefined
  ): IPipeline {
    const { aggregationQuoteStep } = instrument;
    const persistence = new PersistenceGate(db, this.disablePersistence);
    const taskManager = new TaskManager();

    let tradesStoreRef: TradesStreamStore | undefined;
    let candleStoreRef: CandleStreamStore | undefined;
    const chartState = new BinanceChartState({
      canvases,
      pageOpenTimeMs: nowEpochMs() as UnixTimeMs,
      updateSpeedMs: BINANCE_CONFIG.updateSpeedMs,
      // The heatmap cell height is the aggregation bin, not the raw tick size.
      priceStep: aggregationQuoteStep,
      readHoveredBucketKey: () => tradesStoreRef?.hoveredBucketKey,
      requestCandleBlocks: blockIds => candleStoreRef?.requestBlocks(blockIds),
      deps: this.deps,
    });

    const candleStore = new CandleStreamStore({ chartState, persistence });
    candleStoreRef = candleStore;

    let orderbookStoreRef: OrderbookStreamStore | undefined;
    const dataController = new DataController({
      registry: chartState.registry,
      db: db?.orderbook,
      getActiveBlock: () => orderbookStoreRef?.getActiveBlock(),
      updateSpeedMs: BINANCE_CONFIG.updateSpeedMs,
      depth: BINANCE_CONFIG.aggregatedDepth,
      snapshotSlots: SNAPSHOT_SLOTS,
    });

    const orderbookStore = new OrderbookStreamStore({
      chartState,
      dataController,
      persistence,
      instrument: instrument.symbol,
      aggregationQuoteStep,
      updateSpeedMs: BINANCE_CONFIG.updateSpeedMs,
    });
    orderbookStoreRef = orderbookStore;

    const tradesStore = new TradesStreamStore({
      chartState,
      persistence,
      instrument: instrument.symbol,
      gate: orderbookStore,
      onBucketClosed: candleStore.ingestClosedBucket,
    });
    tradesStoreRef = tradesStore;

    return {
      db,
      chartState,
      taskManager,
      dataController,
      persistence,
      orderbookStore,
      candleStore,
      tradesStore,
    };
  }
}

function closeOpened(opened: BinanceDbOpenResult): void {
  if (opened.kind === 'opened') {
    opened.db.close();
  }
}

/** LIFO: consumers of the streams first, then the subscription owners, then shared infrastructure. */
function tearDownPipeline(pipeline: IPipeline): void {
  pipeline.candleStore.dispose();
  pipeline.tradesStore.dispose();
  pipeline.orderbookStore.dispose();
  pipeline.chartState.dispose();
  pipeline.taskManager.dispose();
  pipeline.dataController.dispose();
  const db = pipeline.db;
  if (!isNil(db)) {
    void db.clearAll().finally(() => db.close());
  }
}
