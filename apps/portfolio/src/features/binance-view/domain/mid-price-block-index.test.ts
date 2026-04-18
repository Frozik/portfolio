import { MidPriceBlockIndex } from './mid-price-block-index';
import type { IMidPriceBlockIndexItem } from './mid-price-types';
import type { UnixTimeMs } from './types';

function makeItem(
  blockId: number,
  first: number,
  last: number,
  count = 10,
  textureRowIndex: number | undefined = 0
): IMidPriceBlockIndexItem {
  return {
    blockId: blockId as UnixTimeMs,
    firstTimestampMs: first as UnixTimeMs,
    lastTimestampMs: last as UnixTimeMs,
    basePrice: 0,
    count,
    textureRowIndex,
  };
}

describe('MidPriceBlockIndex', () => {
  it('stores inserted items sorted by firstTimestampMs', () => {
    const index = new MidPriceBlockIndex();
    index.upsert(makeItem(3000, 3000, 3100));
    index.upsert(makeItem(1000, 1000, 1100));
    index.upsert(makeItem(2000, 2000, 2100));
    expect(index.all().map(candidate => candidate.blockId)).toEqual([1000, 2000, 3000]);
  });

  it('upsert mutates an existing block in place without duplicating it', () => {
    const index = new MidPriceBlockIndex();
    index.upsert(makeItem(1000, 1000, 1100, 10));
    index.upsert(makeItem(1000, 1000, 1200, 20));
    expect(index.size).toBe(1);
    const item = index.get(1000 as UnixTimeMs);
    expect(item?.lastTimestampMs).toBe(1200);
    expect(item?.count).toBe(20);
  });

  it('searchRange returns every block whose range overlaps the query', () => {
    const index = new MidPriceBlockIndex();
    index.upsert(makeItem(1000, 1000, 1500));
    index.upsert(makeItem(2000, 2000, 2500));
    index.upsert(makeItem(3000, 3000, 3500));

    const hits = index.searchRange(1200 as UnixTimeMs, 2400 as UnixTimeMs);
    expect(hits.map(candidate => candidate.blockId)).toEqual([1000, 2000]);
  });

  it('searchRange excludes blocks entirely before or entirely after the query', () => {
    const index = new MidPriceBlockIndex();
    index.upsert(makeItem(1000, 1000, 1500));
    index.upsert(makeItem(5000, 5000, 5500));
    const hits = index.searchRange(2000 as UnixTimeMs, 3000 as UnixTimeMs);
    expect(hits).toHaveLength(0);
  });

  it('remove drops only the requested block', () => {
    const index = new MidPriceBlockIndex();
    index.upsert(makeItem(1000, 1000, 1100));
    index.upsert(makeItem(2000, 2000, 2100));
    index.remove(1000 as UnixTimeMs);
    expect(index.size).toBe(1);
    expect(index.get(1000 as UnixTimeMs)).toBeUndefined();
    expect(index.get(2000 as UnixTimeMs)).toBeDefined();
  });

  it('oldestStartMs reflects the earliest block start, undefined when empty', () => {
    const index = new MidPriceBlockIndex();
    expect(index.oldestStartMs()).toBeUndefined();
    index.upsert(makeItem(2000, 2000, 2100));
    index.upsert(makeItem(1000, 1000, 1100));
    expect(index.oldestStartMs()).toBe(1000);
    index.remove(1000 as UnixTimeMs);
    expect(index.oldestStartMs()).toBe(2000);
  });

  it('clear wipes every block', () => {
    const index = new MidPriceBlockIndex();
    index.upsert(makeItem(1000, 1000, 1100));
    index.upsert(makeItem(2000, 2000, 2100));
    index.clear();
    expect(index.size).toBe(0);
    expect(index.all()).toHaveLength(0);
  });
});
