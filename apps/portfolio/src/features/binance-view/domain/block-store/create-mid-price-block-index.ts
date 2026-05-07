import type { UnixTimeMs } from '../types';
import type { IBlockSpatialIndexItem } from './block-spatial-index';
import { BlockSpatialIndex } from './block-spatial-index';

/**
 * Mid-price-specific block-spatial-index entry.
 *
 * Mid-price is 1-D (time-only). Beyond the base shape it carries the
 * block's `firstTimestampMs`, `lastTimestampMs`, `count`, and
 * `basePrice` so both the renderer and the LRU eviction can reason
 * about the block without dereferencing the active block accumulator.
 */
export interface IMidPriceBlockIndexItem extends IBlockSpatialIndexItem {
  readonly firstTimestampMs: UnixTimeMs;
  readonly basePrice: number;
  lastTimestampMs: UnixTimeMs;
  count: number;
}

/**
 * Build the mid-price layer's RBush-backed block index. Thin factory
 * over the shared {@link BlockSpatialIndex}.
 */
export function createMidPriceBlockIndex(): BlockSpatialIndex<IMidPriceBlockIndexItem> {
  return new BlockSpatialIndex<IMidPriceBlockIndexItem>();
}
