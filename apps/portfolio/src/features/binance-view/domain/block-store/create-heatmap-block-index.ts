import type { IBlockSpatialIndexItem } from './block-spatial-index';
import { BlockSpatialIndex } from './block-spatial-index';

/**
 * Heatmap-specific block-spatial-index entry.
 *
 * `count` carries the number of populated snapshots in the block —
 * used by the renderer to derive the active row range when uploading
 * to GPU and by the LRU eviction logic to count blocks against the
 * IDB rolling-window cap.
 */
export interface IHeatmapBlockIndexItem extends IBlockSpatialIndexItem {
  readonly count: number;
}

/**
 * Build the heatmap layer's RBush-backed block index. Thin factory
 * over the shared {@link BlockSpatialIndex} — the only heatmap-specific
 * field beyond the base interface is `count`.
 */
export function createHeatmapBlockIndex(): BlockSpatialIndex<IHeatmapBlockIndexItem> {
  return new BlockSpatialIndex<IHeatmapBlockIndexItem>();
}
