import type { Opaque } from '@frozik/utils/types/base';

import type { IBlockSpatialIndexItem } from './block-store/block-spatial-index';
import type { UnixTimeMs } from './types';

/**
 * Domain model for the trades layer of binance-view.
 *
 * Aggregation invariants:
 *  - Trades are bucketed per second: `bucketStartMs = floor(eventTimeMs / 1000) * 1000`.
 *  - Buckets containing zero trades are NOT emitted, so the GPU texture is
 *    sparse along the time axis. The shader cannot reconstruct a bucket's
 *    timestamp by indexing (`firstBucketStartMs + i*1000`) — every texel
 *    must carry its own time delta. The vertex shader therefore reads
 *    `timeDeltaMs` from the texel directly when computing the bucket's
 *    horizontal NDC position.
 *  - The currently-open (active) bucket is not rendered until it closes
 *    (a trade arrives with `eventTimeMs >= bucketStartMs + 1000`); this
 *    avoids a circle that visibly "pulses" while its second is still live.
 */

/** Opaque numeric trade id from Binance's `@aggTrade` stream (field `a`). */
export type TradeId = Opaque<'TradeId', number>;

/** Opaque base-asset quantity for a trade (field `q`). */
export type Quantity = Opaque<'Quantity', number>;

/**
 * Volume-radius scaling mode. Selected at dev-time via
 * {@link ../domain/trades-constants.DEFAULT_SCALING_MODE}; not exposed
 * as user-facing state. All three branches are kept in code so the
 * developer can A/B them by editing one constant.
 */
export enum ScalingMode {
  Linear = 'linear',
  Log = 'log',
  Percentile = 'percentile',
}

/**
 * One raw trade as received from Binance's `<symbol>@aggTrade` stream
 * (after parsing). Stored separately from the GPU texture — the texture
 * holds aggregates only; raw trades back the click-popup's table.
 */
export interface ITrade {
  readonly tradeId: TradeId;
  readonly eventTimeMs: UnixTimeMs;
  readonly price: number;
  readonly quantity: Quantity;
  /**
   * `true` when the buyer was the maker (i.e. a taker-sell aggression);
   * `false` when the seller was the maker (taker-buy aggression). Drives
   * the buy/sell colour split in the pie chart.
   */
  readonly isBuyerMaker: boolean;
}

/**
 * Per-second aggregate that lands in the GPU texture (4 floats per
 * texel). `vwap` is notional-weighted (`Σ qty·price / Σ qty`) and `buyFraction` is the
 * notional fraction of taker-buy aggression (`isBuyerMaker === false`).
 *
 * No `tradeCount` field — the GPU texture only carries 4 floats per
 * bucket and the popup reads the raw-trade count from the
 * `rawTradesByBucket` map (`trades.length`) when needed; synthesising
 * a sentinel `0` from the texture-side reconstruction path was a
 * footgun in earlier revisions.
 */
export interface ITradeBucket {
  readonly bucketStartMs: UnixTimeMs;
  readonly volumeTotal: number;
  readonly vwap: number;
  /** Notional-weighted buy fraction in `[0, 1]`. */
  readonly buyFraction: number;
}

/**
 * Mutable metadata for a trade-block held in RAM. `blockId` equals
 * `firstBucketStartMs` (single source of truth for keying). Mutable
 * fields advance each time a new bucket is appended; immutables are
 * fixed at block-creation. `textureRowIndex` is `undefined` while the
 * block is LRU-evicted from the GPU texture.
 */
export interface ITradeBlockMeta {
  readonly blockId: UnixTimeMs;
  readonly firstBucketStartMs: UnixTimeMs;
  readonly basePrice: number;
  lastBucketStartMs: UnixTimeMs;
  bucketCount: number;
  textureRowIndex: number | undefined;
}

/**
 * RBush-indexable trade-block entry. Extends the shared spatial-index
 * shape with the trades-specific fields the renderer needs without
 * dereferencing the active accumulator (`bucketCount` for descriptor
 * length, `basePrice` for de-biasing texel Y values).
 */
export interface ITradeBlockIndexItem extends IBlockSpatialIndexItem {
  bucketCount: number;
  basePrice: number;
}

/** Result of a synchronous trade-bucket hit-test (click or hover). */
export interface ITradeBucketHitTestResult {
  readonly blockId: UnixTimeMs;
  readonly bucketStartMs: UnixTimeMs;
  /** Aggregate that the popup header reads (volumeTotal, vwap, …). */
  readonly bucket: ITradeBucket;
  readonly pointerPx: { readonly x: number; readonly y: number };
}

/** Persisted trade-block aggregate row in the `'trade-blocks'` IDB store. */
export interface ITradeBlockRecord {
  readonly blockId: UnixTimeMs;
  readonly firstBucketStartMs: UnixTimeMs;
  readonly lastBucketStartMs: UnixTimeMs;
  readonly basePrice: number;
  readonly bucketCount: number;
  readonly textureRowIndex: number | undefined;
  /** Packed `Float32Array` of bucket aggregates, 4 floats per bucket. */
  readonly data: ArrayBuffer;
}

/**
 * Raw-trade payload for one block, persisted in the
 * `'trade-buckets-raw'` IDB store. Written only on block rotation
 * (whole-block dump), so the multi-megabyte payload is written once per
 * block instead of on every flush.
 */
export interface ITradeBucketRawRecord {
  readonly blockId: UnixTimeMs;
  readonly bucketsRaw: ReadonlyArray<{
    readonly bucketStartMs: UnixTimeMs;
    readonly trades: ReadonlyArray<ITrade>;
  }>;
}
