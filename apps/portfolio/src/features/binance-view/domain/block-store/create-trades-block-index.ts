import type { ITradeBlockIndexItem } from '../trades-types';
import { BlockSpatialIndex } from './block-spatial-index';

/**
 * Build the trades layer's RBush-backed block index. Each block carries
 * `bucketCount` and `basePrice` beyond the base spatial-index shape so
 * the renderer can reconstruct per-bucket centres without dereferencing
 * the active accumulator.
 */
export function createTradesBlockIndex(): BlockSpatialIndex<ITradeBlockIndexItem> {
  return new BlockSpatialIndex<ITradeBlockIndexItem>();
}
