import { describe, expect, test } from 'vitest';

import { BlockRegistry } from './block-registry';
import type { UnixTimeMs } from './types';

function item(blockId: number, count = 128, overrides: { textureRowIndex?: number } = {}) {
  return {
    minX: blockId,
    maxX: blockId + 128_000,
    minY: 0,
    maxY: 0,
    blockId: blockId as UnixTimeMs,
    textureRowIndex: 'textureRowIndex' in overrides ? overrides.textureRowIndex : 0,
    count,
  };
}

describe('BlockRegistry', () => {
  test('stores block and returns it on searchRange by time', () => {
    const registry = new BlockRegistry();
    registry.upsert(item(1000));

    const hits = registry.searchRange(500 as UnixTimeMs, 2000 as UnixTimeMs);
    expect(hits).toHaveLength(1);
    expect(hits[0].blockId).toBe(1000);
  });

  test('upsert with same blockId replaces entry (no duplicates)', () => {
    const registry = new BlockRegistry();
    registry.upsert(item(1000, 16));
    registry.upsert(item(1000, 32));

    const hits = registry.searchRange(0 as UnixTimeMs, 200_000 as UnixTimeMs);
    expect(hits).toHaveLength(1);
    expect(hits[0].count).toBe(32);
    expect(registry.size).toBe(1);
  });

  test('remove deletes the entry; searchRange returns empty', () => {
    const registry = new BlockRegistry();
    registry.upsert(item(1000));
    registry.remove(1000 as UnixTimeMs);

    expect(registry.searchRange(0 as UnixTimeMs, 200_000 as UnixTimeMs)).toHaveLength(0);
    expect(registry.size).toBe(0);
  });

  test('searchRange returns overlapping blocks sorted by firstTimestampMs', () => {
    const registry = new BlockRegistry();
    registry.upsert(item(300_000));
    registry.upsert(item(100_000));
    registry.upsert(item(200_000));

    const hits = registry.searchRange(0 as UnixTimeMs, 500_000 as UnixTimeMs);
    expect(hits.map(hit => hit.blockId)).toEqual([100_000, 200_000, 300_000]);
  });

  test('searchRange excludes blocks outside the window', () => {
    const registry = new BlockRegistry();
    registry.upsert(item(100_000));
    registry.upsert(item(500_000));

    const hits = registry.searchRange(50_000 as UnixTimeMs, 150_000 as UnixTimeMs);
    expect(hits).toHaveLength(1);
    expect(hits[0].blockId).toBe(100_000);
  });

  test('oldestStartMs returns the smallest firstTimestampMs', () => {
    const registry = new BlockRegistry();
    expect(registry.oldestStartMs()).toBeUndefined();

    registry.upsert(item(500_000));
    registry.upsert(item(100_000));
    registry.upsert(item(300_000));

    expect(registry.oldestStartMs()).toBe(100_000);
  });

  test('clear resets size to zero', () => {
    const registry = new BlockRegistry();
    registry.upsert(item(1000));
    registry.upsert(item(2000));
    registry.clear();

    expect(registry.size).toBe(0);
    expect(registry.searchRange(0 as UnixTimeMs, 10_000 as UnixTimeMs)).toHaveLength(0);
  });

  test('get returns the item by blockId', () => {
    const registry = new BlockRegistry();
    registry.upsert(item(1000, 64, { textureRowIndex: 5 }));

    const found = registry.get(1000 as UnixTimeMs);
    expect(found?.textureRowIndex).toBe(5);
    expect(found?.count).toBe(64);
  });

  test('textureRowIndex can be undefined (LRU-evicted from GPU)', () => {
    const registry = new BlockRegistry();
    registry.upsert(item(1000, 128, { textureRowIndex: undefined }));

    const found = registry.get(1000 as UnixTimeMs);
    expect(found?.textureRowIndex).toBeUndefined();
  });
});
