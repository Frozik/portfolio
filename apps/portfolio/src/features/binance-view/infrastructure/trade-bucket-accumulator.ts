import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { ITradeBlockFlushEvent } from '../domain/flush-events';
import type { IClosedTradeBucket, ITrade, ITradeBlockMeta } from '../domain/trades-types';
import type { UnixTimeMs } from '../domain/types';

interface IActiveBucket {
  readonly bucketStartMs: UnixTimeMs;
  readonly open: number;
  high: number;
  low: number;
  close: number;
  volumeTotal: number;
  notionalSum: number;
  notionalBuy: number;
  /** Handed to the block by reference on close and never mutated afterwards. */
  readonly rawTrades: ITrade[];
}

interface IActiveBlock {
  meta: ITradeBlockMeta;
  readonly data: Float32Array;
  readonly rawTradesByBucket: Map<UnixTimeMs, readonly ITrade[]>;
}

export interface ITradeBucketAccumulatorParams {
  readonly maxBucketsPerBlock: number;
  readonly floatsPerBucket: number;
  readonly activeBucketRawTradesSoftCap: number;
  readonly onFlush: (event: ITradeBlockFlushEvent) => void;
  /** Fired for every bucket the moment it closes, before the block flush that carries it. */
  readonly onBucketClosed?: (bucket: IClosedTradeBucket) => void;
}

const MS_PER_SECOND = 1000;

/**
 * Two-level accumulator: an open per-second bucket aggregates incoming
 * trades, and the open block packs closed buckets into a texture-aligned
 * `Float32Array`. A bucket is flushed only after a trade in a later second
 * closes it, so the rendered circle never pulses while its second is live.
 *
 * Block rotation emits two events: the sealed block with
 * `closedByRotation=true` (its raw trades are final — the moment to persist
 * them) and then the fresh empty block with `isNewBlock=true`. Raw trades
 * per bucket are capped at `activeBucketRawTradesSoftCap` so a flash-crash
 * second cannot exhaust memory; aggregates keep counting the full volume.
 */
export class TradeBucketAccumulator {
  private readonly maxBucketsPerBlock: number;
  private readonly floatsPerBucket: number;
  private readonly activeBucketRawTradesSoftCap: number;
  private readonly onFlush: (event: ITradeBlockFlushEvent) => void;
  private readonly onBucketClosed: ((bucket: IClosedTradeBucket) => void) | undefined;

  private activeBlock: IActiveBlock | undefined;
  private activeBucket: IActiveBucket | undefined;
  private disposed = false;

  constructor(params: ITradeBucketAccumulatorParams) {
    this.maxBucketsPerBlock = params.maxBucketsPerBlock;
    this.floatsPerBucket = params.floatsPerBucket;
    this.activeBucketRawTradesSoftCap = params.activeBucketRawTradesSoftCap;
    this.onFlush = params.onFlush;
    this.onBucketClosed = params.onBucketClosed;
  }

  addTrade(trade: ITrade): void {
    if (this.disposed) {
      return;
    }

    const bucketStartMs = (Math.floor(trade.eventTimeMs / MS_PER_SECOND) *
      MS_PER_SECOND) as UnixTimeMs;

    if (isNil(this.activeBucket)) {
      this.activeBlock ??= createBlock(bucketStartMs, trade.price, this.blockFloats);
      this.activeBucket = createBucket(bucketStartMs, trade.price);
      this.accumulateTrade(this.activeBucket, trade);
      return;
    }

    if (this.activeBucket.bucketStartMs === bucketStartMs) {
      this.accumulateTrade(this.activeBucket, trade);
      return;
    }

    assert(
      !isNil(this.activeBlock),
      'TradeBucketAccumulator: activeBlock must exist when activeBucket is open'
    );
    this.closeBucketInto(this.activeBlock, this.activeBucket);
    this.flushOrRotate(this.activeBlock, bucketStartMs, trade.price);

    this.activeBucket = createBucket(bucketStartMs, trade.price);
    this.accumulateTrade(this.activeBucket, trade);
  }

  /** Drops active state. Partial active bucket is lost. Idempotent. */
  dispose(): void {
    this.disposed = true;
    this.activeBlock = undefined;
    this.activeBucket = undefined;
  }

  private get blockFloats(): number {
    return this.maxBucketsPerBlock * this.floatsPerBucket;
  }

  private accumulateTrade(bucket: IActiveBucket, trade: ITrade): void {
    const notional = trade.quantity * trade.price;
    bucket.high = Math.max(bucket.high, trade.price);
    bucket.low = Math.min(bucket.low, trade.price);
    bucket.close = trade.price;
    bucket.volumeTotal += trade.quantity;
    bucket.notionalSum += notional;
    if (!trade.isBuyerMaker) {
      bucket.notionalBuy += notional;
    }
    if (bucket.rawTrades.length < this.activeBucketRawTradesSoftCap) {
      bucket.rawTrades.push(trade);
    }
  }

  private closeBucketInto(block: IActiveBlock, active: IActiveBucket): void {
    assert(active.volumeTotal > 0, 'TradeBucketAccumulator: volumeTotal must be > 0');
    assert(active.notionalSum > 0, 'TradeBucketAccumulator: notionalSum must be > 0');
    const bucket: IClosedTradeBucket = {
      bucketStartMs: active.bucketStartMs,
      volumeTotal: active.volumeTotal,
      vwap: active.notionalSum / active.volumeTotal,
      buyFraction: active.notionalBuy / active.notionalSum,
      open: active.open,
      high: active.high,
      low: active.low,
      close: active.close,
    };

    const offset = block.meta.bucketCount * this.floatsPerBucket;
    block.data[offset + 0] = bucket.bucketStartMs - block.meta.firstBucketStartMs;
    block.data[offset + 1] = bucket.vwap - block.meta.basePrice;
    block.data[offset + 2] = bucket.volumeTotal;
    block.data[offset + 3] = bucket.buyFraction;
    block.meta = {
      ...block.meta,
      bucketCount: block.meta.bucketCount + 1,
      lastBucketStartMs: bucket.bucketStartMs,
    };
    block.rawTradesByBucket.set(active.bucketStartMs, active.rawTrades);
    this.onBucketClosed?.(bucket);
  }

  private flushOrRotate(block: IActiveBlock, bucketStartMs: UnixTimeMs, price: number): void {
    if (block.meta.bucketCount < this.maxBucketsPerBlock) {
      this.emit(block, { isNewBlock: false, closedByRotation: false });
      return;
    }
    this.emit(block, { isNewBlock: false, closedByRotation: true });
    const newBlock = createBlock(bucketStartMs, price, this.blockFloats);
    this.activeBlock = newBlock;
    this.emit(newBlock, { isNewBlock: true, closedByRotation: false });
  }

  private emit(
    block: IActiveBlock,
    flags: { readonly isNewBlock: boolean; readonly closedByRotation: boolean }
  ): void {
    this.onFlush({
      block: block.meta,
      data: block.data,
      rawTradesByBucket: block.rawTradesByBucket,
      ...flags,
    });
  }
}

function createBlock(blockId: UnixTimeMs, basePrice: number, floats: number): IActiveBlock {
  return {
    meta: {
      blockId,
      firstBucketStartMs: blockId,
      basePrice,
      lastBucketStartMs: blockId,
      bucketCount: 0,
    },
    data: new Float32Array(floats),
    rawTradesByBucket: new Map(),
  };
}

function createBucket(bucketStartMs: UnixTimeMs, firstPrice: number): IActiveBucket {
  return {
    bucketStartMs,
    open: firstPrice,
    high: firstPrice,
    low: firstPrice,
    close: firstPrice,
    volumeTotal: 0,
    notionalSum: 0,
    notionalBuy: 0,
    rawTrades: [],
  };
}
