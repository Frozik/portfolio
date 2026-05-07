import type { IOrderbookBlockRecord } from '../infrastructure/binance-indexeddb';

import type { UnixTimeMs } from './types';

/**
 * Recency-ordered LRU cache for `IOrderbookBlockRecord`. Accessing a
 * key moves it to the most-recent position; `put` evicts the oldest
 * entry when the cache is full.
 */
export class BlockRecordLruCache {
  private readonly entries = new Map<UnixTimeMs, IOrderbookBlockRecord>();
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(blockId: UnixTimeMs): IOrderbookBlockRecord | undefined {
    const record = this.entries.get(blockId);
    if (record !== undefined) {
      this.entries.delete(blockId);
      this.entries.set(blockId, record);
    }
    return record;
  }

  put(record: IOrderbookBlockRecord): void {
    if (this.entries.has(record.blockId)) {
      this.entries.delete(record.blockId);
    } else if (this.entries.size >= this.capacity) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }
    this.entries.set(record.blockId, record);
  }

  clear(): void {
    this.entries.clear();
  }
}
