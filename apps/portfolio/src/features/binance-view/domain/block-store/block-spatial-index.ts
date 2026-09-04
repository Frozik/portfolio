import RBush from 'rbush';

import type { UnixTimeMs } from '../types';

/**
 * Base shape every block-spatial-index entry must satisfy. Each layer
 * extends it with its own per-block fields (cell stats, basePrice,
 * bucketCount, ...) — the index treats them transparently because RBush
 * indexes 2D bounding boxes, not the payload.
 *
 * `minY` / `maxY` are stubbed to 0 in single-axis (time-only) layouts.
 */
export interface IBlockSpatialIndexItem {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly blockId: UnixTimeMs;
  /** GPU texture slot, or `undefined` while the block is LRU-evicted from the texture. */
  readonly textureRowIndex: number | undefined;
}

const RBUSH_MAX_ENTRIES = 9;

/**
 * Generic in-memory spatial index of blocks by time range, backed by
 * RBush. Each `binance-view` layer (orderbook, mid-price, trades)
 * parameterises this class with its own `TItem extends
 * IBlockSpatialIndexItem` and supplies factory functions that pin
 * format-specific fields — see `create-heatmap-block-index.ts`,
 * `create-mid-price-block-index.ts`, `create-trades-block-index.ts`.
 *
 * Items are immutable: every update goes through `upsert(item)`, which
 * removes and re-inserts the entry so the RBush stays consistent.
 */
export class BlockSpatialIndex<TItem extends IBlockSpatialIndexItem> {
  private readonly tree = new RBush<TItem>(RBUSH_MAX_ENTRIES);
  private readonly byId = new Map<UnixTimeMs, TItem>();

  upsert(item: TItem): void {
    const previous = this.byId.get(item.blockId);
    if (previous !== undefined) {
      this.tree.remove(previous);
    }
    this.byId.set(item.blockId, item);
    this.tree.insert(item);
  }

  searchRange(fromMs: UnixTimeMs, toMs: UnixTimeMs, minY = 0, maxY = 0): ReadonlyArray<TItem> {
    const hits = this.tree.search({ minX: fromMs, maxX: toMs, minY, maxY });
    return hits.slice().sort((left, right) => left.minX - right.minX);
  }

  remove(blockId: UnixTimeMs): TItem | undefined {
    const item = this.byId.get(blockId);
    if (item === undefined) {
      return undefined;
    }
    this.tree.remove(item);
    this.byId.delete(blockId);
    return item;
  }

  findByBlockId(blockId: UnixTimeMs): TItem | undefined {
    return this.byId.get(blockId);
  }

  oldestStartMs(): UnixTimeMs | undefined {
    let oldest: UnixTimeMs | undefined;
    for (const item of this.byId.values()) {
      if (oldest === undefined || item.minX < oldest) {
        oldest = item.minX as UnixTimeMs;
      }
    }
    return oldest;
  }

  all(): ReadonlyArray<TItem> {
    return Array.from(this.byId.values());
  }

  clear(): void {
    this.tree.clear();
    this.byId.clear();
  }

  get size(): number {
    return this.byId.size;
  }
}
