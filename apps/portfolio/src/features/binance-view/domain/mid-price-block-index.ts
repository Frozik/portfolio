import { sortedIndexBy } from 'lodash-es';

import type { IMidPriceBlockIndexItem } from './mid-price-types';
import type { UnixTimeMs } from './types';

/**
 * In-memory index of mid-price blocks, keyed by
 * `firstTimestampMs` and kept sorted ascending. Time-only queries
 * over a bounded N (≤ `MAX_MID_PRICE_BLOCKS`) don't justify an
 * RBush; a sorted array with binary-search insert gives the same
 * asymptotic properties for insert / search with a fraction of the
 * code.
 *
 * Single-writer invariant: the renderer owns the only instance and
 * every mutation goes through the methods here — callers must not
 * rearrange the underlying array manually.
 */
export class MidPriceBlockIndex {
  private readonly items: IMidPriceBlockIndexItem[] = [];

  upsert(item: IMidPriceBlockIndexItem): void {
    const existingIndex = this.findIndex(item.blockId);
    if (existingIndex >= 0) {
      const existing = this.items[existingIndex];
      existing.lastTimestampMs = item.lastTimestampMs;
      existing.count = item.count;
      existing.textureRowIndex = item.textureRowIndex;
      return;
    }
    const insertAt = sortedIndexBy(this.items, item, candidate => candidate.firstTimestampMs);
    this.items.splice(insertAt, 0, item);
  }

  /**
   * Block whose `[firstTimestampMs, lastTimestampMs]` overlaps
   * `[fromMs, toMs]`, ordered by `firstTimestampMs` ascending. A
   * linear scan is cheap at this scale and keeps the implementation
   * trivial to audit.
   */
  searchRange(fromMs: UnixTimeMs, toMs: UnixTimeMs): readonly IMidPriceBlockIndexItem[] {
    const hits: IMidPriceBlockIndexItem[] = [];
    for (const item of this.items) {
      if (item.lastTimestampMs < fromMs || item.firstTimestampMs > toMs) {
        continue;
      }
      hits.push(item);
    }
    return hits;
  }

  get(blockId: UnixTimeMs): IMidPriceBlockIndexItem | undefined {
    const index = this.findIndex(blockId);
    return index >= 0 ? this.items[index] : undefined;
  }

  remove(blockId: UnixTimeMs): void {
    const index = this.findIndex(blockId);
    if (index >= 0) {
      this.items.splice(index, 1);
    }
  }

  oldestStartMs(): UnixTimeMs | undefined {
    return this.items.length > 0 ? this.items[0].firstTimestampMs : undefined;
  }

  all(): readonly IMidPriceBlockIndexItem[] {
    return this.items;
  }

  clear(): void {
    this.items.length = 0;
  }

  get size(): number {
    return this.items.length;
  }

  private findIndex(blockId: UnixTimeMs): number {
    for (let index = 0; index < this.items.length; index++) {
      if (this.items[index].blockId === blockId) {
        return index;
      }
    }
    return -1;
  }
}
