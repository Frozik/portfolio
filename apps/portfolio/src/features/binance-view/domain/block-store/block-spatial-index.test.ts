import { describe, expect, test } from 'vitest';

import type { UnixTimeMs } from '../types';
import type { IBlockSpatialIndexItem } from './block-spatial-index';
import { BlockSpatialIndex } from './block-spatial-index';

interface IHeatmapShapedItem extends IBlockSpatialIndexItem {
  count: number;
}

interface ITimeStripItem extends IBlockSpatialIndexItem {
  readonly basePrice: number;
  count: number;
}

function heatmapItem(
  blockIdValue: number,
  count = 128,
  overrides: { textureRowIndex?: number; spanMs?: number } = {}
): IHeatmapShapedItem {
  const span = overrides.spanMs ?? 128_000;
  return {
    minX: blockIdValue,
    maxX: blockIdValue + span,
    minY: 0,
    maxY: 0,
    blockId: blockIdValue as UnixTimeMs,
    textureRowIndex: 'textureRowIndex' in overrides ? overrides.textureRowIndex : 0,
    count,
  };
}

function stripItem(blockIdValue: number, basePrice = 30000, count = 256): ITimeStripItem {
  return {
    minX: blockIdValue,
    maxX: blockIdValue + 256_000,
    minY: 0,
    maxY: 0,
    blockId: blockIdValue as UnixTimeMs,
    textureRowIndex: 0,
    basePrice,
    count,
  };
}

describe('BlockSpatialIndex', () => {
  test('inserted block is returned by overlapping searchRange', () => {
    const index = new BlockSpatialIndex<IHeatmapShapedItem>();
    index.upsert(heatmapItem(1000));

    const hits = index.searchRange(500 as UnixTimeMs, 2000 as UnixTimeMs);
    expect(hits).toHaveLength(1);
    expect(hits[0].blockId).toBe(1000);
  });

  test('upsert with same blockId replaces the previous entry', () => {
    const index = new BlockSpatialIndex<IHeatmapShapedItem>();
    index.upsert(heatmapItem(1000, 16));
    index.upsert(heatmapItem(1000, 32));

    const hits = index.searchRange(0 as UnixTimeMs, 200_000 as UnixTimeMs);
    expect(hits).toHaveLength(1);
    expect(hits[0].count).toBe(32);
    expect(index.size).toBe(1);
  });

  test('remove returns the removed item and clears it from search results', () => {
    const index = new BlockSpatialIndex<IHeatmapShapedItem>();
    index.upsert(heatmapItem(1000));
    const removed = index.remove(1000 as UnixTimeMs);

    expect(removed?.blockId).toBe(1000);
    expect(index.searchRange(0 as UnixTimeMs, 200_000 as UnixTimeMs)).toHaveLength(0);
    expect(index.size).toBe(0);
  });

  test('remove of a non-existent blockId is a no-op returning undefined', () => {
    const index = new BlockSpatialIndex<IHeatmapShapedItem>();
    expect(index.remove(9999 as UnixTimeMs)).toBeUndefined();
  });

  test('searchRange returns overlapping blocks ordered by start time', () => {
    const index = new BlockSpatialIndex<IHeatmapShapedItem>();
    index.upsert(heatmapItem(300_000));
    index.upsert(heatmapItem(100_000));
    index.upsert(heatmapItem(200_000));

    const hits = index.searchRange(0 as UnixTimeMs, 500_000 as UnixTimeMs);
    expect(hits.map(hit => hit.blockId)).toEqual([100_000, 200_000, 300_000]);
  });

  test('searchRange excludes blocks outside the query window', () => {
    const index = new BlockSpatialIndex<IHeatmapShapedItem>();
    index.upsert(heatmapItem(100_000));
    index.upsert(heatmapItem(500_000));

    const hits = index.searchRange(50_000 as UnixTimeMs, 150_000 as UnixTimeMs);
    expect(hits).toHaveLength(1);
    expect(hits[0].blockId).toBe(100_000);
  });

  test('oldestStartMs returns the smallest minX, undefined when empty', () => {
    const index = new BlockSpatialIndex<IHeatmapShapedItem>();
    expect(index.oldestStartMs()).toBeUndefined();

    index.upsert(heatmapItem(500_000));
    index.upsert(heatmapItem(100_000));
    index.upsert(heatmapItem(300_000));

    expect(index.oldestStartMs()).toBe(100_000);

    index.remove(100_000 as UnixTimeMs);
    expect(index.oldestStartMs()).toBe(300_000);
  });

  test('clear wipes every entry', () => {
    const index = new BlockSpatialIndex<IHeatmapShapedItem>();
    index.upsert(heatmapItem(1000));
    index.upsert(heatmapItem(2000));
    index.clear();

    expect(index.size).toBe(0);
    expect(index.searchRange(0 as UnixTimeMs, 10_000 as UnixTimeMs)).toHaveLength(0);
  });

  test('findByBlockId returns the stored item including layer-specific fields', () => {
    const index = new BlockSpatialIndex<IHeatmapShapedItem>();
    index.upsert(heatmapItem(1000, 64, { textureRowIndex: 5 }));

    const found = index.findByBlockId(1000 as UnixTimeMs);
    expect(found?.textureRowIndex).toBe(5);
    expect(found?.count).toBe(64);
  });

  test('textureRowIndex can be undefined (LRU-evicted from GPU)', () => {
    const index = new BlockSpatialIndex<IHeatmapShapedItem>();
    index.upsert(heatmapItem(1000, 128, { textureRowIndex: undefined }));

    const found = index.findByBlockId(1000 as UnixTimeMs);
    expect(found?.textureRowIndex).toBeUndefined();
  });

  test('generic param: index works with mid-price-shaped items carrying extra fields', () => {
    const index = new BlockSpatialIndex<ITimeStripItem>();
    index.upsert(stripItem(1000, 30000));
    index.upsert(stripItem(2000, 30100));

    const found = index.findByBlockId(2000 as UnixTimeMs);
    expect(found?.basePrice).toBe(30100);
    expect(found?.count).toBe(256);

    const hits = index.searchRange(0 as UnixTimeMs, 500_000 as UnixTimeMs);
    expect(hits).toHaveLength(2);
    expect(hits.map(hit => hit.basePrice)).toEqual([30000, 30100]);
  });

  test('all() returns every stored item without ordering guarantee but with no duplicates', () => {
    const index = new BlockSpatialIndex<IHeatmapShapedItem>();
    index.upsert(heatmapItem(1000));
    index.upsert(heatmapItem(2000));
    index.upsert(heatmapItem(1000, 64));

    const items = index.all();
    expect(items).toHaveLength(2);
    const blockIds = items.map(candidate => candidate.blockId).sort((a, b) => a - b);
    expect(blockIds).toEqual([1000, 2000]);
  });
});
