import { describe, expect, it, vi } from 'vitest';

import type { ISlotPoolGrowth } from './lruSlotPool';
import { LruSlotPool } from './lruSlotPool';

function doubleCapacity(currentCapacity: number): number {
  return currentCapacity * 2;
}

describe('LruSlotPool', () => {
  it('hands out sequential slots from the high-water-mark', () => {
    const pool = new LruSlotPool({
      initialCapacity: 4,
      maxCapacity: 8,
      growCapacity: doubleCapacity,
    });

    expect(pool.acquire()).toBe(0);
    expect(pool.acquire()).toBe(1);
    expect(pool.highWaterMark).toBe(2);
    expect(pool.allocatedCount).toBe(2);
  });

  it('reuses released slots before advancing the high-water-mark, newest first', () => {
    const pool = new LruSlotPool({
      initialCapacity: 4,
      maxCapacity: 8,
      growCapacity: doubleCapacity,
    });

    const first = pool.acquire();
    const second = pool.acquire();
    expect(first).toBe(0);
    expect(second).toBe(1);

    pool.release(0);
    pool.release(1);

    expect(pool.allocatedCount).toBe(0);
    expect(pool.acquire()).toBe(1);
    expect(pool.acquire()).toBe(0);
    expect(pool.highWaterMark).toBe(2);
  });

  it('ignores releases of slots that are not allocated', () => {
    const pool = new LruSlotPool({
      initialCapacity: 4,
      maxCapacity: 8,
      growCapacity: doubleCapacity,
    });

    pool.acquire();
    pool.release(0);
    pool.release(0);
    pool.release(3);

    expect(pool.acquire()).toBe(0);
    expect(pool.acquire()).toBe(1);
  });

  it('grows the capacity and reports the used region before adopting it', () => {
    const growths: ISlotPoolGrowth[] = [];
    const pool = new LruSlotPool({
      initialCapacity: 2,
      maxCapacity: 8,
      growCapacity: doubleCapacity,
      onGrow: growth => growths.push(growth),
    });

    pool.acquire();
    pool.acquire();
    expect(pool.capacity).toBe(2);

    expect(pool.acquire()).toBe(2);
    expect(pool.capacity).toBe(4);
    expect(growths).toEqual([{ previousCapacity: 2, newCapacity: 4, usedSlots: 2 }]);
  });

  it('clamps growth to maxCapacity', () => {
    const pool = new LruSlotPool({
      initialCapacity: 2,
      maxCapacity: 3,
      growCapacity: doubleCapacity,
    });

    pool.acquire();
    pool.acquire();
    pool.acquire();

    expect(pool.capacity).toBe(3);
    expect(pool.highWaterMark).toBe(3);
  });

  it('evicts the least recently touched slot once the ceiling is reached', () => {
    const onEvict = vi.fn();
    const pool = new LruSlotPool({
      initialCapacity: 3,
      maxCapacity: 3,
      growCapacity: doubleCapacity,
      onEvict,
    });

    pool.acquire();
    pool.acquire();
    pool.acquire();
    pool.touch(0);

    expect(pool.acquire()).toBe(1);
    expect(onEvict).toHaveBeenCalledTimes(1);
    expect(onEvict).toHaveBeenCalledWith(1);
    expect(pool.allocatedCount).toBe(3);
    expect(pool.has(0)).toBe(true);
  });

  it('does not grow past maxCapacity when evicting', () => {
    const onGrow = vi.fn();
    const pool = new LruSlotPool({
      initialCapacity: 1,
      maxCapacity: 1,
      growCapacity: doubleCapacity,
      onGrow,
    });

    pool.acquire();

    expect(pool.acquire()).toBe(0);
    expect(onGrow).not.toHaveBeenCalled();
  });

  it('returns undefined when nothing can be allocated or evicted', () => {
    const pool = new LruSlotPool({
      initialCapacity: 1,
      maxCapacity: 1,
      growCapacity: doubleCapacity,
    });

    pool.acquire();
    pool.clear();

    expect(pool.acquire()).toBeUndefined();
  });

  it('clear drops allocations but keeps capacity', () => {
    const pool = new LruSlotPool({
      initialCapacity: 2,
      maxCapacity: 8,
      growCapacity: doubleCapacity,
    });

    pool.acquire();
    pool.acquire();
    pool.clear();

    expect(pool.allocatedCount).toBe(0);
    expect(pool.capacity).toBe(2);
    expect(pool.highWaterMark).toBe(2);
  });
});
