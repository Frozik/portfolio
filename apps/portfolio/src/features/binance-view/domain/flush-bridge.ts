import type { IBlockMeta } from './types';

/**
 * Shape of a flush-event crossing the domain boundary from
 * `BlockAccumulator` (infrastructure) to `BinanceHeatmapRenderer` (domain).
 *
 * Duplicates `IBlockFlushEvent` from `infrastructure/block-accumulator.ts`
 * so the domain layer doesn't import infrastructure — keeps the
 * dependency direction presentation → application → domain ← infrastructure.
 */
export interface IBlockFlushEventBridge {
  readonly block: IBlockMeta;
  readonly data: Float32Array;
  readonly isNewBlock: boolean;
  readonly addedSnapshots: number;
  readonly latestMagnitudeMin: number;
  readonly latestMagnitudeMax: number;
}
