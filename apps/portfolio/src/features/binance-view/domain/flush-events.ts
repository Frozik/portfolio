import type { ICandleBlockMeta } from './candle-types';
import type { ITrade, ITradeBlockMeta } from './trades-types';
import type { IBlockMeta, UnixTimeMs } from './types';

/**
 * Flush events are the contract between the accumulators (infrastructure) and
 * the stores / renderer that consume them. `data` is the accumulator's live
 * block buffer — consumers copy the slice they persist and never mutate it.
 */
export interface IBlockFlushEvent {
  readonly block: IBlockMeta;
  readonly data: Float32Array;
  readonly isNewBlock: boolean;
  readonly addedSnapshots: number;
  /** Min `price × volume` observed across the last snapshot. `0` if no non-zero volumes. */
  readonly latestMagnitudeMin: number;
  /** Max `price × volume` observed across the last snapshot. */
  readonly latestMagnitudeMax: number;
}

export interface ICandleFlushEvent {
  readonly block: ICandleBlockMeta;
  readonly data: Float32Array;
  readonly isNewBlock: boolean;
  readonly addedCandles: number;
}

/**
 * `closedByRotation` marks the single event where a block has just been sealed
 * — only then is `rawTradesByBucket` complete, so it is the one moment to dump
 * the block's raw trades to persistence.
 */
export interface ITradeBlockFlushEvent {
  readonly block: ITradeBlockMeta;
  readonly data: Float32Array;
  readonly rawTradesByBucket: ReadonlyMap<UnixTimeMs, readonly ITrade[]>;
  readonly isNewBlock: boolean;
  readonly closedByRotation: boolean;
}
