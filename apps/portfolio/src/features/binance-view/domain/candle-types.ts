import type { IBlockSpatialIndexItem } from './block-store/block-spatial-index';
import type { UnixTimeMs } from './types';

/** Open/high/low/close of one second of trades, as the trade accumulator closes a bucket. */
export interface IOhlcBucket {
  readonly bucketStartMs: UnixTimeMs;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
}

/** One second of the candle series, with the moving averages of closes up to and including it. */
export interface ICandle extends IOhlcBucket {
  readonly movingAverage5: number;
  readonly movingAverage10: number;
}

/** Metadata for a candle block; `blockId` equals `firstBucketStartMs`. */
export interface ICandleBlockMeta {
  readonly blockId: UnixTimeMs;
  readonly firstBucketStartMs: UnixTimeMs;
  readonly lastBucketStartMs: UnixTimeMs;
  /** Prices in the block's texels are stored relative to it, keeping them inside `f32` range. */
  readonly basePrice: number;
  readonly count: number;
}

/** Persisted candle block: the meta plus the packed texel data. */
export interface ICandleBlockRecord extends ICandleBlockMeta {
  readonly data: ArrayBuffer;
}

export interface ICandleBlockIndexItem extends IBlockSpatialIndexItem {
  readonly firstBucketStartMs: UnixTimeMs;
  readonly lastBucketStartMs: UnixTimeMs;
  readonly basePrice: number;
  readonly count: number;
}
