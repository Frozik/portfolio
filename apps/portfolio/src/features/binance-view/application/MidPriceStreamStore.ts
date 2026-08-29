import type { Milliseconds } from '@frozik/utils/date/types';
import { makeAutoObservable } from 'mobx';
import type { IBinanceDb } from '../domain/binance-db';
import {
  MAX_MID_PRICE_BLOCKS,
  MID_PRICE_FLUSH_EVERY_SAMPLES,
  MID_PRICE_SAMPLES_PER_BLOCK,
} from '../domain/constants';
import { getMidPrice } from '../domain/get-mid-price';
import type { IQuantizedSnapshot } from '../domain/types';
import type { IMidPriceFlushEvent } from '../infrastructure/mid-price-block-accumulator';
import { MidPriceBlockAccumulator } from '../infrastructure/mid-price-block-accumulator';
import type { BinanceChartState } from './chart-state';

export interface IMidPriceStreamStoreParams {
  readonly chartState: BinanceChartState;
  readonly db: IBinanceDb | undefined;
  readonly updateSpeedMs: Milliseconds;
}

/**
 * Per-stream sub-store extracted from the legacy `BinanceViewStore`
 * god-store. Owns the mid-price block accumulator, the IDB
 * persistence path, and the eviction loop that keeps the GPU texture
 * within {@link MAX_MID_PRICE_BLOCKS}.
 *
 * Mid-price doesn't open its own WebSocket: the orchestrator (or
 * orderbook store) forwards every quantized orderbook snapshot via
 * {@link ingestOrderbookSnapshot}, and this store derives a mid-price
 * sample from it. Keeping the derivation here (instead of in the
 * orderbook store) lets each sub-store own a single accumulator and a
 * single IDB write path.
 */
export class MidPriceStreamStore {
  private readonly chartState: BinanceChartState;
  private readonly db: IBinanceDb | undefined;
  private readonly updateSpeedMs: Milliseconds;

  private accumulator: MidPriceBlockAccumulator | undefined = undefined;

  constructor(params: IMidPriceStreamStoreParams) {
    this.chartState = params.chartState;
    this.db = params.db;
    this.updateSpeedMs = params.updateSpeedMs;

    makeAutoObservable(this, {}, { autoBind: true });
  }

  startStream(): void {
    if (this.accumulator !== undefined) {
      return;
    }
    this.accumulator = new MidPriceBlockAccumulator({
      samplesPerBlock: MID_PRICE_SAMPLES_PER_BLOCK,
      updateSpeedMs: this.updateSpeedMs,
      flushEverySamples: MID_PRICE_FLUSH_EVERY_SAMPLES,
      onFlush: this.handleMidPriceFlush,
    });
  }

  /**
   * Forwarded by the orchestrator on every quantized orderbook
   * snapshot. Derives the mid-price and pushes it into the
   * accumulator; snapshots without bid/ask cause `getMidPrice` to
   * return `undefined` and are skipped.
   */
  ingestOrderbookSnapshot(snapshot: IQuantizedSnapshot): void {
    if (this.accumulator === undefined) {
      return;
    }
    const midPrice = getMidPrice(snapshot);
    if (midPrice === undefined) {
      return;
    }
    this.accumulator.addSample({
      eventTimeMs: snapshot.eventTimeMs,
      price: midPrice,
    });
  }

  dispose(): void {
    this.accumulator?.dispose();
    this.accumulator = undefined;
  }

  private handleMidPriceFlush(event: IMidPriceFlushEvent): void {
    this.chartState.ingestMidPriceFlush(event);
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
    const index = this.chartState.midPriceIndex;
    while (index.size > MAX_MID_PRICE_BLOCKS) {
      const oldestMs = index.oldestStartMs();
      if (oldestMs === undefined) {
        break;
      }
      const item = index.findByBlockId(oldestMs);
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
