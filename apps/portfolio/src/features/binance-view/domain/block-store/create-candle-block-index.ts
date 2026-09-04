import type { ICandleBlockIndexItem } from '../candle-types';
import { BlockSpatialIndex } from './block-spatial-index';

export function createCandleBlockIndex(): BlockSpatialIndex<ICandleBlockIndexItem> {
  return new BlockSpatialIndex<ICandleBlockIndexItem>();
}
