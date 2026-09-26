import { describe, expect, it, vi } from 'vitest';

import { KeyedSlotPool } from './keyedSlotPool';
import { doubleSlotCapacity } from './lruSlotPool';

function createPool(options: { initialCapacity?: number; maxCapacity?: number } = {}) {
  const onEvict = vi.fn<(key: string) => void>();
  const pool = new KeyedSlotPool<string>({
    initialCapacity: options.initialCapacity ?? 2,
    maxCapacity: options.maxCapacity ?? 2,
    growCapacity: doubleSlotCapacity,
    onEvict,
  });
  return { pool, onEvict };
}

describe('KeyedSlotPool', () => {
  it('returns the same slot for a key allocated twice', () => {
    const { pool } = createPool();

    const first = pool.allocate('a');

    expect(pool.allocate('a')).toBe(first);
    expect(pool.allocatedCount).toBe(1);
    expect(pool.getSlot('a')).toBe(first);
  });

  it('evicts the least recently touched key once the ceiling is reached', () => {
    const { pool, onEvict } = createPool();

    pool.allocate('a');
    pool.allocate('b');
    pool.touch('a');
    const slot = pool.allocate('c');

    expect(onEvict).toHaveBeenCalledWith('b');
    expect(pool.getSlot('b')).toBeUndefined();
    expect(slot).toBe(1);
  });

  it('frees a key so its slot is reused before evicting anything', () => {
    const { pool, onEvict } = createPool();

    pool.allocate('a');
    const freed = pool.allocate('b');
    pool.free('b');

    expect(pool.allocate('c')).toBe(freed);
    expect(onEvict).not.toHaveBeenCalled();
  });

  it('forgets every key on clear', () => {
    const { pool } = createPool();

    pool.allocate('a');
    pool.clear();

    expect(pool.allocatedCount).toBe(0);
    expect(pool.getSlot('a')).toBeUndefined();
  });
});
