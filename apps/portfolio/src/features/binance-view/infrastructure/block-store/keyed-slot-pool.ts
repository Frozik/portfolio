import { assert } from '@frozik/utils/assert/assert';
import type { ISlotPoolGrowth } from '@frozik/utils/webgpu/lruSlotPool';
import { LruSlotPool } from '@frozik/utils/webgpu/lruSlotPool';

export interface IKeyedSlotPoolOptions<TKey extends NonNullable<unknown>> {
  readonly initialCapacity: number;
  readonly maxCapacity: number;
  readonly growCapacity: (currentCapacity: number) => number;
  readonly onGrow?: (growth: ISlotPoolGrowth) => void;
  /** Invoked after the key lost its slot, so the caller can drop cross-references. */
  readonly onEvict: (key: TKey) => void;
}

/**
 * Maps opaque block keys onto the dense slot indices handed out by
 * {@link LruSlotPool}. Every binance-view texture manager keys its GPU
 * slots by block id and shares this bookkeeping; the texture geometry
 * (how a slot maps to texels) stays with the individual manager.
 */
export class KeyedSlotPool<TKey extends NonNullable<unknown>> {
  private readonly pool: LruSlotPool;
  private readonly onEvict: (key: TKey) => void;
  private readonly keyToSlot = new Map<TKey, number>();
  private readonly slotToKey = new Map<number, TKey>();

  constructor(options: IKeyedSlotPoolOptions<TKey>) {
    this.onEvict = options.onEvict;
    this.pool = new LruSlotPool({
      initialCapacity: options.initialCapacity,
      maxCapacity: options.maxCapacity,
      growCapacity: options.growCapacity,
      onGrow: options.onGrow,
      onEvict: this.handleSlotEvicted,
    });
  }

  /**
   * Reserve a slot for `key`, refreshing recency when the key already
   * holds one. Once the pool is at its ceiling the least recently
   * touched key is evicted to make room.
   */
  allocate(key: TKey): number {
    const existing = this.keyToSlot.get(key);
    if (existing !== undefined) {
      this.pool.touch(existing);
      return existing;
    }

    const slotIndex = this.pool.acquire();
    assert(
      slotIndex !== undefined,
      'KeyedSlotPool: cannot allocate — pool is exhausted with nothing to evict'
    );

    this.keyToSlot.set(key, slotIndex);
    this.slotToKey.set(slotIndex, key);
    return slotIndex;
  }

  touch(key: TKey): void {
    const slotIndex = this.keyToSlot.get(key);
    if (slotIndex !== undefined) {
      this.pool.touch(slotIndex);
    }
  }

  free(key: TKey): void {
    const slotIndex = this.keyToSlot.get(key);
    if (slotIndex === undefined) {
      return;
    }
    this.keyToSlot.delete(key);
    this.slotToKey.delete(slotIndex);
    this.pool.release(slotIndex);
  }

  getSlot(key: TKey): number | undefined {
    return this.keyToSlot.get(key);
  }

  get capacity(): number {
    return this.pool.capacity;
  }

  get allocatedCount(): number {
    return this.keyToSlot.size;
  }

  clear(): void {
    this.pool.clear();
    this.keyToSlot.clear();
    this.slotToKey.clear();
  }

  private readonly handleSlotEvicted = (slotIndex: number): void => {
    const key = this.slotToKey.get(slotIndex);
    if (key === undefined) {
      return;
    }
    this.keyToSlot.delete(key);
    this.slotToKey.delete(slotIndex);
    this.onEvict(key);
  };
}
