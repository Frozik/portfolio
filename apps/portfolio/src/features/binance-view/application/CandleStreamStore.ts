import { toFail } from '@frozik/utils/value-descriptors/fails/utils';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import { CandleSeriesBuilder } from '../domain/candle-series';
import type { ICandleBlockRecord, IOhlcBucket } from '../domain/candle-types';
import { CANDLES_PER_BLOCK, MAX_CANDLE_HISTORY_BLOCKS } from '../domain/constants';
import type { ICandleFlushEvent } from '../domain/flush-events';
import type { UnixTimeMs } from '../domain/types';
import { CandleBlockAccumulator } from '../infrastructure/candle-block-accumulator';
import type { BinanceChartState } from './chart-state';
import type { PersistenceGate } from './persistence-gate';

export interface ICandleStreamStoreParams {
  readonly chartState: BinanceChartState;
  readonly persistence: PersistenceGate;
}

/**
 * Builds the one-second candle series from closed trade buckets, packs it
 * into blocks for the GPU and IndexedDB, keeps the history within
 * `MAX_CANDLE_HISTORY_BLOCKS`, and reloads blocks the GPU texture has
 * evicted when they scroll back into view.
 */
export class CandleStreamStore {
  private readonly chartState: BinanceChartState;
  private readonly persistence: PersistenceGate;
  private readonly series = new CandleSeriesBuilder();
  private accumulator: CandleBlockAccumulator | undefined = undefined;
  /** Blocks whose reload is in flight, so one frame's request is not repeated on the next. */
  private readonly pendingReloads = new Set<UnixTimeMs>();
  private disposed = false;

  constructor(params: ICandleStreamStoreParams) {
    this.chartState = params.chartState;
    this.persistence = params.persistence;

    makeAutoObservable<CandleStreamStore, 'series' | 'pendingReloads'>(
      this,
      { series: false, pendingReloads: false },
      { autoBind: true }
    );
  }

  startStream(): void {
    if (!isNil(this.accumulator)) {
      return;
    }
    this.accumulator = new CandleBlockAccumulator({
      candlesPerBlock: CANDLES_PER_BLOCK,
      onFlush: this.handleFlush,
    });
  }

  /** A closed second of trades; seconds without trades are filled by the series builder. */
  ingestClosedBucket(bucket: IOhlcBucket): void {
    const accumulator = this.accumulator;
    if (isNil(accumulator)) {
      return;
    }
    for (const candle of this.series.append(bucket)) {
      accumulator.addCandle(candle);
    }
  }

  /** Reloads blocks the renderer found evicted from the texture; a block in flight is not requested twice. */
  requestBlocks(blockIds: readonly UnixTimeMs[]): void {
    for (const blockId of blockIds) {
      if (!this.pendingReloads.has(blockId)) {
        this.pendingReloads.add(blockId);
        void this.reloadBlock(blockId);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.accumulator?.dispose();
    this.accumulator = undefined;
    this.pendingReloads.clear();
  }

  private async reloadBlock(blockId: UnixTimeMs): Promise<void> {
    const db = this.persistence.db;
    if (isNil(db)) {
      this.pendingReloads.delete(blockId);
      return;
    }
    let record: ICandleBlockRecord | undefined;
    try {
      record = await db.candles.getBlock(blockId);
    } catch (error) {
      this.persistence.disable(toFail(error));
    }
    this.pendingReloads.delete(blockId);
    if (this.disposed || isNil(record)) {
      return;
    }
    this.chartState.restoreCandleBlock(record);
  }

  private handleFlush(event: ICandleFlushEvent): void {
    this.chartState.ingestCandleFlush(event);
    this.persistence.write(db => db.candles.putBlock(toBlockRecord(event)));
    if (event.isNewBlock) {
      this.enforceHistoryCap();
    }
  }

  private enforceHistoryCap(): void {
    const index = this.chartState.candleIndex;
    while (index.size > MAX_CANDLE_HISTORY_BLOCKS) {
      const oldestMs = index.oldestStartMs();
      if (isNil(oldestMs)) {
        return;
      }
      index.remove(oldestMs);
      this.chartState.releaseCandleBlockSlot(oldestMs);
      this.persistence.write(db => db.candles.deleteBlock(oldestMs));
    }
  }
}

function toBlockRecord(event: ICandleFlushEvent): ICandleBlockRecord {
  const dataCopy = new ArrayBuffer(event.data.byteLength);
  new Uint8Array(dataCopy).set(
    new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength)
  );
  return { ...event.block, data: dataCopy };
}
