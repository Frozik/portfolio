import RBush from 'rbush';

import type { UnixTimeMs } from './types';

export interface IBlockIndexItem {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  blockId: UnixTimeMs;
  textureRowIndex: number | undefined;
  count: number;
}

const RBUSH_MAX_ENTRIES = 9;

/**
 * In-memory spatial index of orderbook blocks by time range.
 *
 * RBush is 2D; only X is meaningful (time), Y is stubbed to 0. Entries
 * carry the IndexedDB key (`blockId`), current GPU row (or `undefined`
 * if the block was LRU-evicted from GPU but still lives in IDB), and
 * actual snapshot count.
 */
export class BlockRegistry {
  private readonly tree = new RBush<IBlockIndexItem>(RBUSH_MAX_ENTRIES);
  private readonly byId = new Map<UnixTimeMs, IBlockIndexItem>();

  upsert(item: IBlockIndexItem): void {
    const previous = this.byId.get(item.blockId);
    if (previous !== undefined) {
      this.tree.remove(previous);
    }
    this.byId.set(item.blockId, item);
    this.tree.insert(item);
  }

  searchRange(fromMs: UnixTimeMs, toMs: UnixTimeMs): ReadonlyArray<IBlockIndexItem> {
    const hits = this.tree.search({ minX: fromMs, maxX: toMs, minY: 0, maxY: 0 });
    return hits.slice().sort((left, right) => left.minX - right.minX);
  }

  remove(blockId: UnixTimeMs): void {
    const item = this.byId.get(blockId);
    if (item === undefined) {
      return;
    }
    this.tree.remove(item);
    this.byId.delete(blockId);
  }

  get(blockId: UnixTimeMs): IBlockIndexItem | undefined {
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

  all(): ReadonlyArray<IBlockIndexItem> {
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
