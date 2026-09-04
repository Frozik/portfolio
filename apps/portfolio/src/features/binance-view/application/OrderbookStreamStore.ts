import type { Milliseconds } from '@frozik/utils/date/types';
import { isNil } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';
import type { Subscription } from 'rxjs';

import type { IOrderbookBlockRecord } from '../domain/binance-db';
import { BINANCE_CONFIG } from '../domain/config';
import { MAX_HISTORY_BLOCKS, SNAPSHOT_SLOTS } from '../domain/constants';
import type { DataController, IActiveBlockSource } from '../domain/data-controller';
import type { IBlockFlushEvent } from '../domain/flush-events';
import type { InstrumentSymbol } from '../domain/instruments';
import { plotHeightCssPx, plotWidthCssPx } from '../domain/math';
import type {
  ConnectionState,
  IHitTestResult,
  IQuantizedSnapshot,
  UnixTimeMs,
} from '../domain/types';
import { BlockAccumulator } from '../infrastructure/block-accumulator';
import { liveOrderBook$ } from '../infrastructure/orderbook-stream';
import type { BinanceChartState } from './chart-state';
import type { IOrderbookGate } from './IOrderbookGate';
import type { PersistenceGate } from './persistence-gate';

/**
 * Consecutive interpolated snapshots after which the indicator flips to
 * `'disconnected'` — matches the quantizer's repeat-last cap.
 */
const DISCONNECT_STREAK_THRESHOLD = 5;

export interface IOrderbookStreamStoreParams {
  readonly chartState: BinanceChartState;
  readonly dataController: DataController;
  readonly persistence: PersistenceGate;
  readonly instrument: InstrumentSymbol;
  readonly aggregationQuoteStep: number;
  readonly updateSpeedMs: Milliseconds;
}

/**
 * Owns the live orderbook subscription, the block accumulator, the
 * cell hit-test against {@link DataController} and the connection
 * indicators. Implements {@link IOrderbookGate} for the trades store.
 */
export class OrderbookStreamStore implements IOrderbookGate {
  connection: ConnectionState = 'idle';
  snapshotsReceived = 0;
  lastDisplaySnapshotTimeMs: UnixTimeMs | undefined = undefined;
  errorMessage: string | undefined = undefined;
  selectedCell: IHitTestResult | undefined = undefined;
  /** Flips once on the first depth snapshot and stays set across reconnects until `dispose`. */
  hasFirstOrderbookSnapshot = false;

  private readonly chartState: BinanceChartState;
  private readonly dataController: DataController;
  private readonly persistence: PersistenceGate;
  private readonly instrument: InstrumentSymbol;
  private readonly aggregationQuoteStep: number;
  private readonly updateSpeedMs: Milliseconds;

  private interpolatedStreak = 0;
  private subscription: Subscription | undefined = undefined;
  private accumulator: BlockAccumulator | undefined = undefined;
  /** Only the most recent hover lookup may commit, so a slower stale one cannot overwrite it. */
  private hitTestToken = 0;

  constructor(params: IOrderbookStreamStoreParams) {
    this.chartState = params.chartState;
    this.dataController = params.dataController;
    this.persistence = params.persistence;
    this.instrument = params.instrument;
    this.aggregationQuoteStep = params.aggregationQuoteStep;
    this.updateSpeedMs = params.updateSpeedMs;

    makeAutoObservable(this, {}, { autoBind: true });
  }

  /** The in-flight block, folded into hit-tests before it reaches RAM/IDB. */
  getActiveBlock(): IActiveBlockSource | undefined {
    return this.accumulator?.getActiveBlock();
  }

  startStream(): void {
    if (!isNil(this.subscription)) {
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
      aggregationQuoteStep: this.aggregationQuoteStep,
      reconnectDelayMs: BINANCE_CONFIG.reconnectDelayMs,
      maxSequenceGapRetries: BINANCE_CONFIG.maxSequenceGapRetries,
    }).subscribe({
      next: this.handleSnapshot,
      error: this.handleError,
    });
  }

  async resolveCellAt(pointerPx: { readonly x: number; readonly y: number }): Promise<void> {
    const token = ++this.hitTestToken;
    const result = await this.dataController.resolveCellAt({
      pointerPx,
      plotRect: {
        width: plotWidthCssPx(this.chartState.canvas.clientWidth),
        height: plotHeightCssPx(this.chartState.canvas.clientHeight),
      },
      viewport: this.chartState.viewport,
      priceStep: this.aggregationQuoteStep,
    });
    if (token !== this.hitTestToken) {
      return;
    }
    runInAction(() => {
      this.selectedCell = result;
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
    this.hasFirstOrderbookSnapshot = true;
    if (snapshot.isInterpolated) {
      this.interpolatedStreak += 1;
      this.connection =
        this.interpolatedStreak >= DISCONNECT_STREAK_THRESHOLD ? 'disconnected' : 'connected';
    } else {
      this.interpolatedStreak = 0;
      this.connection = 'connected';
    }
    this.accumulator?.addSnapshot(snapshot);
  }

  private handleFlush(event: IBlockFlushEvent): void {
    this.chartState.ingestFlush(event);
    this.lastDisplaySnapshotTimeMs = event.block.lastTimestampMs;
    this.persistence.write(db => db.orderbook.putBlock(toBlockRecord(event)));

    if (event.isNewBlock) {
      this.enforceHistoryCap();
    }
  }

  private enforceHistoryCap(): void {
    const registry = this.chartState.registry;
    while (registry.size > MAX_HISTORY_BLOCKS) {
      const oldestMs = registry.oldestStartMs();
      if (isNil(oldestMs)) {
        return;
      }
      registry.remove(oldestMs);
      this.chartState.releaseBlockSlot(oldestMs);
      this.persistence.write(db => db.orderbook.deleteBlock(oldestMs));
    }
  }

  private handleError(error: unknown): void {
    this.connection = 'error';
    this.errorMessage = error instanceof Error ? error.message : String(error);
  }
}

/** Copies the live buffer so the accumulator can keep writing while IndexedDB clones the record. */
function toBlockRecord(event: IBlockFlushEvent): IOrderbookBlockRecord {
  const dataCopy = new ArrayBuffer(event.data.byteLength);
  new Uint8Array(dataCopy).set(
    new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength)
  );
  return {
    blockId: event.block.blockId,
    firstTimestampMs: event.block.firstTimestampMs,
    lastTimestampMs: event.block.lastTimestampMs,
    count: event.block.count,
    data: dataCopy,
  };
}
