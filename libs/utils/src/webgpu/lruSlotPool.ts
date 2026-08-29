import { LRUCache } from 'lru-cache';

import { assert } from '../assert/assert';

export interface ISlotPoolGrowth {
  /** Slot capacity before the growth step. */
  readonly previousCapacity: number;
  /** Slot capacity the pool will switch to once the callback returns. */
  readonly newCapacity: number;
  /** Slots handed out so far — everything below this index must survive the growth. */
  readonly usedSlots: number;
}

export interface ILruSlotPoolOptions {
  readonly initialCapacity: number;
  readonly maxCapacity: number;
  /**
   * Capacity to aim for when the pool runs out of slots. The result is
   * clamped to `maxCapacity`; growth stops once that ceiling is reached
   * and the pool starts evicting instead.
   */
  readonly growCapacity: (currentCapacity: number) => number;
  /**
   * Resize the backing store (e.g. recreate a GPU texture and copy the
   * used region over). Called before the pool adopts the new capacity.
   */
  readonly onGrow?: (growth: ISlotPoolGrowth) => void;
  readonly onEvict?: (slotIndex: number) => void;
}

/** Default growth policy: amortised O(1) appends by doubling the capacity. */
export function doubleSlotCapacity(currentCapacity: number): number {
  return currentCapacity * 2;
}

/**
 * Recency-aware allocator of dense slot indices, backing GPU texture
 * atlases that pack fixed-size blocks into a growable texture.
 *
 * Allocation order:
 *   1. Free list (LIFO — the most recently released slot is the one most
 *      likely to still be warm in whatever caches the caller keeps).
 *   2. High-water-mark — append a slot while below the current capacity.
 *   3. Grow — ask `growCapacity` for a larger capacity, let `onGrow`
 *      migrate the backing store, then append.
 *   4. LRU eviction — reuse the least recently touched slot and report it
 *      through `onEvict` so the caller can drop its cross-references.
 *
 * Slot *geometry* (texel layout, row packing, write offsets) deliberately
 * stays with the caller: only the allocation policy is shared.
 */
export class LruSlotPool {
  private readonly maxCapacity: number;
  private readonly growCapacity: (currentCapacity: number) => number;
  private readonly onGrow: ((growth: ISlotPoolGrowth) => void) | undefined;
  private readonly onEvict: ((slotIndex: number) => void) | undefined;

  private readonly freeSlots: number[] = [];
  private readonly recency: LRUCache<number, true>;

  private capacityValue: number;
  private highWaterMarkValue = 0;

  constructor(options: ILruSlotPoolOptions) {
    assert(options.initialCapacity > 0, 'LruSlotPool: initialCapacity must be positive');
    assert(
      options.maxCapacity >= options.initialCapacity,
      'LruSlotPool: maxCapacity must be >= initialCapacity'
    );

    this.maxCapacity = options.maxCapacity;
    this.growCapacity = options.growCapacity;
    this.onGrow = options.onGrow;
    this.onEvict = options.onEvict;
    this.capacityValue = options.initialCapacity;

    // Eviction is driven explicitly by `acquire`, so the cache is sized to
    // the hard ceiling and never evicts on its own.
    this.recency = new LRUCache({ max: options.maxCapacity });
  }

  /**
   * Reserve a slot. Returns `undefined` only when the pool is at its
   * capacity ceiling and holds nothing evictable.
   */
  acquire(): number | undefined {
    const slotIndex = this.popFreeSlot() ?? this.advanceHighWaterMark() ?? this.growAndAdvance();

    if (slotIndex !== undefined) {
      this.recency.set(slotIndex, true);
      return slotIndex;
    }

    return this.evictAndReuse();
  }

  /** Refresh recency so the slot moves to the back of the eviction queue. */
  touch(slotIndex: number): void {
    this.recency.get(slotIndex);
  }

  /** Return an allocated slot to the free list. Unknown slots are ignored. */
  release(slotIndex: number): void {
    if (!this.recency.has(slotIndex)) {
      return;
    }
    this.recency.delete(slotIndex);
    this.freeSlots.push(slotIndex);
  }

  has(slotIndex: number): boolean {
    return this.recency.has(slotIndex);
  }

  get capacity(): number {
    return this.capacityValue;
  }

  get allocatedCount(): number {
    return this.recency.size;
  }

  /** Highest slot index ever handed out, plus one. */
  get highWaterMark(): number {
    return this.highWaterMarkValue;
  }

  /** Drop all allocations. Capacity and high-water-mark are left untouched. */
  clear(): void {
    this.recency.clear();
    this.freeSlots.length = 0;
  }

  private popFreeSlot(): number | undefined {
    return this.freeSlots.pop();
  }

  private advanceHighWaterMark(): number | undefined {
    if (this.highWaterMarkValue >= this.capacityValue) {
      return undefined;
    }
    const slotIndex = this.highWaterMarkValue;
    this.highWaterMarkValue++;
    return slotIndex;
  }

  private growAndAdvance(): number | undefined {
    if (this.capacityValue >= this.maxCapacity) {
      return undefined;
    }

    const newCapacity = Math.min(this.growCapacity(this.capacityValue), this.maxCapacity);
    assert(
      newCapacity > this.capacityValue,
      'LruSlotPool: growCapacity must return a capacity larger than the current one'
    );

    this.onGrow?.({
      previousCapacity: this.capacityValue,
      newCapacity,
      usedSlots: this.highWaterMarkValue,
    });
    this.capacityValue = newCapacity;

    return this.advanceHighWaterMark();
  }

  private evictAndReuse(): number | undefined {
    // rkeys() walks from the least recently used entry — the first one is
    // the eviction candidate.
    const oldestSlot = this.recency.rkeys().next().value;

    if (oldestSlot === undefined) {
      return undefined;
    }

    this.recency.delete(oldestSlot);
    this.onEvict?.(oldestSlot);
    this.recency.set(oldestSlot, true);

    return oldestSlot;
  }
}
