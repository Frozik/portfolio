import type { ITrade } from './trades-types';
import type { UnixTimeMs } from './types';

export type RawTradesByBucket = ReadonlyMap<UnixTimeMs, readonly ITrade[]>;

/**
 * RAM cache of raw trades per flushed block, read by the popup when a
 * bucket is clicked. Bounded to `capacity` blocks in first-in-first-out
 * order; older blocks fall through to a lazy IndexedDB reload.
 */
export class RawTradesCache {
  private readonly bucketsByBlock = new Map<UnixTimeMs, RawTradesByBucket>();

  constructor(private readonly capacity: number) {}

  get(blockId: UnixTimeMs, bucketStartMs: UnixTimeMs): readonly ITrade[] | undefined {
    return this.bucketsByBlock.get(blockId)?.get(bucketStartMs);
  }

  has(blockId: UnixTimeMs): boolean {
    return this.bucketsByBlock.has(blockId);
  }

  /** Replaces the block's buckets; a block keeps its queue position across repeated flushes. */
  set(blockId: UnixTimeMs, buckets: RawTradesByBucket): void {
    this.bucketsByBlock.set(blockId, buckets);
    this.evictBeyondCapacity();
  }

  delete(blockId: UnixTimeMs): void {
    this.bucketsByBlock.delete(blockId);
  }

  clear(): void {
    this.bucketsByBlock.clear();
  }

  private evictBeyondCapacity(): void {
    for (const blockId of this.bucketsByBlock.keys()) {
      if (this.bucketsByBlock.size <= this.capacity) {
        return;
      }
      this.bucketsByBlock.delete(blockId);
    }
  }
}
