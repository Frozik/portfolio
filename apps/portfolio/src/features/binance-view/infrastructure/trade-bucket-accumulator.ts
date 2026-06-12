import { assert } from '@frozik/utils/assert/assert';

import type { ITrade, ITradeBlockMeta, ITradeBucket } from '../domain/trades-types';
import type { UnixTimeMs } from '../domain/types';

/**
 * Two-level accumulator for per-second trade buckets (see trades.md
 * §1.5 / §2.3). Keeps an open **active bucket** that aggregates
 * incoming trades for the current second, and an open **active block**
 * that collects the closed buckets into a texture-aligned
 * `Float32Array` (4 floats × `maxBucketsPerBlock` buckets).
 *
 * The active bucket is **not** rendered: a bucket is only flushed to
 * GPU/persistence after a trade in a *new* second arrives, finalising
 * its `vwap` / `buyFraction`. `dispose()` therefore drops the partial
 * active bucket — symmetric with `MidPriceBlockAccumulator.dispose()`.
 *
 * Block rotation: when the active block reaches `maxBucketsPerBlock`,
 * the accumulator emits **two** flush events — one with
 * `isNewBlock=false` for the just-completed block, then one with
 * `isNewBlock=true` for the freshly created one — so the orchestrator
 * can persist the closed block before the new block's first bucket is
 * mutated.
 *
 * Raw-trade handoff: when a bucket closes, its `rawTrades` array is
 * stored **by reference** under `block.rawTradesByBucket`. The active
 * bucket no longer mutates that array after close, so the reference is
 * safe to read downstream without copy. A soft cap
 * (`activeBucketRawTradesSoftCap`) guards against flash-crash seconds
 * — once exceeded, the bucket is marked `truncated` and further raw
 * trades are *not* pushed into the array, but `volumeTotal` /
 * `notionalSum` keep aggregating the full count.
 *
 * Pure infrastructure — no MobX, no RxJS, no GPU. Tests should not
 * need any environment.
 */

interface IActiveBucketState {
  bucketStartMs: UnixTimeMs;
  volumeTotal: number;
  notionalSum: number;
  notionalBuy: number;
  notionalSell: number;
  /** Reference handed off to the block on close — never copied. */
  rawTrades: ITrade[];
  truncated: boolean;
}

interface IActiveBlockState {
  meta: ITradeBlockMeta;
  data: Float32Array;
  /** By-reference map from bucketStartMs to the bucket's raw trades. */
  rawTradesByBucket: Map<UnixTimeMs, ITrade[]>;
}

/**
 * Event emitted when a closed bucket has been packed into the block's
 * texture buffer (`isNewBlock=false`), or when a fresh block has just
 * been created after rotation (`isNewBlock=true`). `data` is shared
 * with the accumulator — do not mutate.
 */
export interface ITradeBlockFlushEvent {
  readonly block: ITradeBlockMeta;
  readonly data: Float32Array;
  readonly rawTradesByBucket: ReadonlyMap<UnixTimeMs, ITrade[]>;
  readonly isNewBlock: boolean;
}

export interface ITradeBucketAccumulatorParams {
  readonly maxBucketsPerBlock: number;
  readonly floatsPerBucket: number;
  readonly activeBucketRawTradesSoftCap: number;
  readonly onFlush: (event: ITradeBlockFlushEvent) => void;
}

const MS_PER_SECOND = 1000;

export class TradeBucketAccumulator {
  private readonly maxBucketsPerBlock: number;
  private readonly floatsPerBucket: number;
  private readonly activeBucketRawTradesSoftCap: number;
  private readonly onFlush: (event: ITradeBlockFlushEvent) => void;

  private activeBlock: IActiveBlockState | undefined;
  private activeBucket: IActiveBucketState | undefined;
  private disposed = false;

  constructor(params: ITradeBucketAccumulatorParams) {
    this.maxBucketsPerBlock = params.maxBucketsPerBlock;
    this.floatsPerBucket = params.floatsPerBucket;
    this.activeBucketRawTradesSoftCap = params.activeBucketRawTradesSoftCap;
    this.onFlush = params.onFlush;
  }

  addTrade(trade: ITrade): void {
    if (this.disposed) {
      return;
    }

    const bucketStartMs = (Math.floor(trade.eventTimeMs / MS_PER_SECOND) *
      MS_PER_SECOND) as UnixTimeMs;

    // First trade ever: bootstrap both block and bucket.
    if (this.activeBucket === undefined) {
      if (this.activeBlock === undefined) {
        this.activeBlock = this.createBlock(bucketStartMs, trade.price);
      }
      this.activeBucket = this.createBucket(bucketStartMs);
      this.accumulateTrade(this.activeBucket, trade);
      return;
    }

    // Same second — keep accumulating.
    if (this.activeBucket.bucketStartMs === bucketStartMs) {
      this.accumulateTrade(this.activeBucket, trade);
      return;
    }

    // New second — close the bucket, append to block, then handle rotation.
    assert(
      this.activeBlock !== undefined,
      'TradeBucketAccumulator: activeBlock must exist when activeBucket is open'
    );
    const closedBucket = this.closeBucket(this.activeBucket);
    const block = this.activeBlock;
    this.appendBucketToBlock(block, closedBucket);
    this.handoffRawTrades(block, this.activeBucket.bucketStartMs, this.activeBucket.rawTrades);

    if (block.meta.bucketCount >= this.maxBucketsPerBlock) {
      // Rotate: emit completed block first, then create + emit fresh block.
      this.onFlush({
        block: block.meta,
        data: block.data,
        rawTradesByBucket: block.rawTradesByBucket,
        isNewBlock: false,
      });
      const newBlock = this.createBlock(bucketStartMs, trade.price);
      this.activeBlock = newBlock;
      this.onFlush({
        block: newBlock.meta,
        data: newBlock.data,
        rawTradesByBucket: newBlock.rawTradesByBucket,
        isNewBlock: true,
      });
    } else {
      this.onFlush({
        block: block.meta,
        data: block.data,
        rawTradesByBucket: block.rawTradesByBucket,
        isNewBlock: false,
      });
    }

    // Open a fresh active bucket for the new second.
    this.activeBucket = this.createBucket(bucketStartMs);
    this.accumulateTrade(this.activeBucket, trade);
  }

  /** Drops active state. Partial active bucket is lost. Idempotent. */
  dispose(): void {
    this.disposed = true;
    this.activeBlock = undefined;
    this.activeBucket = undefined;
  }

  private accumulateTrade(bucket: IActiveBucketState, trade: ITrade): void {
    const notional = trade.quantity * trade.price;
    bucket.volumeTotal += trade.quantity;
    bucket.notionalSum += notional;
    if (trade.isBuyerMaker) {
      bucket.notionalSell += notional;
    } else {
      bucket.notionalBuy += notional;
    }
    if (bucket.rawTrades.length < this.activeBucketRawTradesSoftCap) {
      bucket.rawTrades.push(trade);
    } else {
      bucket.truncated = true;
    }
  }

  private closeBucket(bucket: IActiveBucketState): ITradeBucket {
    // Buckets are created lazily on the first trade of their second, so
    // by construction these aggregates are strictly positive (qty/price
    // on Binance are always > 0). Defensive asserts catch corrupt input
    // or future refactor breakage.
    assert(bucket.volumeTotal > 0, 'TradeBucketAccumulator.closeBucket: volumeTotal must be > 0');
    assert(bucket.notionalSum > 0, 'TradeBucketAccumulator.closeBucket: notionalSum must be > 0');
    return {
      bucketStartMs: bucket.bucketStartMs,
      volumeTotal: bucket.volumeTotal,
      vwap: bucket.notionalSum / bucket.volumeTotal,
      buyFraction: bucket.notionalBuy / bucket.notionalSum,
    };
  }

  private appendBucketToBlock(block: IActiveBlockState, bucket: ITradeBucket): void {
    // 1) Write 4 floats at offset bucketCount * floatsPerBucket.
    // 2) THEN increment bucketCount.
    // 3) THEN update lastBucketStartMs.
    // (Order matches trades.md §2.3 pseudocode.)
    const offset = block.meta.bucketCount * this.floatsPerBucket;
    block.data[offset + 0] = bucket.bucketStartMs - block.meta.firstBucketStartMs;
    block.data[offset + 1] = bucket.vwap - block.meta.basePrice;
    block.data[offset + 2] = bucket.volumeTotal;
    block.data[offset + 3] = bucket.buyFraction;
    block.meta.bucketCount += 1;
    block.meta.lastBucketStartMs = bucket.bucketStartMs;
  }

  private handoffRawTrades(
    block: IActiveBlockState,
    bucketStartMs: UnixTimeMs,
    rawTrades: ITrade[]
  ): void {
    block.rawTradesByBucket.set(bucketStartMs, rawTrades);
  }

  private createBlock(blockId: UnixTimeMs, basePrice: number): IActiveBlockState {
    const meta: ITradeBlockMeta = {
      blockId,
      firstBucketStartMs: blockId,
      basePrice,
      lastBucketStartMs: blockId,
      bucketCount: 0,
      textureRowIndex: undefined,
    };
    return {
      meta,
      data: new Float32Array(this.maxBucketsPerBlock * this.floatsPerBucket),
      rawTradesByBucket: new Map(),
    };
  }

  private createBucket(bucketStartMs: UnixTimeMs): IActiveBucketState {
    return {
      bucketStartMs,
      volumeTotal: 0,
      notionalSum: 0,
      notionalBuy: 0,
      notionalSell: 0,
      rawTrades: [],
      truncated: false,
    };
  }
}
