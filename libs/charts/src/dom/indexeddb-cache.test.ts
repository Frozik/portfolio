import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { columnsOf } from '../core/series/columns';
import type { IStoredSegment } from '../data/timeseries/cache/persistent-cache';
import { TIME_MAX, TIME_MIN } from '../data/timeseries/interval';
import { describePersistentCache } from '../testing/persistent-cache-contract';
import { indexedDbCache } from './indexeddb-cache';

let databases = 0;
function freshName(): string {
  databases += 1;
  return `charts-test-${databases}`;
}

function points(start: bigint, count: number): IStoredSegment {
  return {
    start,
    end: start + BigInt(count - 1),
    columns: columnsOf({
      shape: 'point',
      points: Array.from({ length: count }, (_, index) => ({
        x: start + BigInt(index),
        value: index,
      })),
    }),
  };
}

const EVERYTHING = { start: TIME_MIN, end: TIME_MAX };

const created = new Map<object, ReturnType<typeof indexedDbCache>>();

describePersistentCache('IndexedDB', {
  create: () => {
    const cache = indexedDbCache({ name: freshName() });
    created.set(cache, cache);
    return cache;
  },
  settle: async cache => {
    await created.get(cache)?.flush();
  },
});

describe('the IndexedDB cache', () => {
  it('gives back what was written, bigint times and all', async () => {
    const cache = indexedDbCache({ name: freshName() });
    cache.write('a', points(100n, 3));
    await cache.flush();

    const [segment] = await cache.read('a', EVERYTHING);

    expect(segment).toMatchObject({ start: 100n, end: 102n });
    expect(segment.columns.x).toEqual(BigInt64Array.from([100n, 101n, 102n]));
    expect(segment.columns.shape === 'point' && Array.from(segment.columns.value)).toEqual([
      0, 1, 2,
    ]);
  });

  it('keeps candles with all four of their values', async () => {
    const cache = indexedDbCache({ name: freshName() });
    cache.write('a', {
      start: 0n,
      end: 9n,
      columns: columnsOf({
        shape: 'candle',
        candles: [{ x: 0n, open: 1, min: 0, max: 3, close: 2 }],
      }),
    });
    await cache.flush();

    const [segment] = await cache.read('a', EVERYTHING);

    expect(segment.columns).toMatchObject({ shape: 'candle', length: 1 });
    expect(segment.columns.shape === 'candle' && segment.columns.max[0]).toBe(3);
  });

  it('reads only the segments of the series asked for that reach into the interval', async () => {
    const cache = indexedDbCache({ name: freshName() });
    cache.write('a', points(0n, 10));
    cache.write('a', points(100n, 10));
    cache.write('b', points(0n, 10));
    await cache.flush();

    const found = await cache.read('a', { start: 105n, end: 500n });

    expect(found.map(segment => segment.start)).toEqual([100n]);
  });

  it('outlives the cache object: another one over the same database finds the data', async () => {
    const name = freshName();
    const first = indexedDbCache({ name });
    first.write('a', points(0n, 10));
    await first.flush();

    expect(await indexedDbCache({ name }).read('a', EVERYTHING)).toHaveLength(1);
  });

  it('discards everything when the data version changes', async () => {
    const name = freshName();
    const first = indexedDbCache({ name, version: 1 });
    first.write('a', points(0n, 10));
    await first.flush();

    expect(await indexedDbCache({ name, version: 2 }).read('a', EVERYTHING)).toEqual([]);
  });

  it('drops the segments used longest ago once over its budget', async () => {
    const BYTES_PER_POINT = 16;
    const cache = indexedDbCache({ name: freshName(), maxBytes: 25 * BYTES_PER_POINT });
    cache.write('old', points(0n, 10));
    await cache.flush();
    await new Promise(resolve => setTimeout(resolve, 5));
    cache.write('new', points(0n, 10));
    await cache.flush();
    await new Promise(resolve => setTimeout(resolve, 5));
    await cache.read('old', EVERYTHING);
    await new Promise(resolve => setTimeout(resolve, 5));

    cache.write('newest', points(0n, 10));
    await cache.flush();

    expect(await cache.read('new', EVERYTHING)).toEqual([]);
    expect(await cache.read('old', EVERYTHING)).toHaveLength(1);
    expect(await cache.read('newest', EVERYTHING)).toHaveLength(1);
  });

  it('does not read segments past their age', async () => {
    const cache = indexedDbCache({ name: freshName(), maxAgeMs: 1 });
    cache.write('a', points(0n, 10));
    await cache.flush();
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(await cache.read('a', EVERYTHING)).toEqual([]);
  });

  it('turns itself off after a failure and reports it once, without throwing', async () => {
    const failures: unknown[] = [];
    const cache = indexedDbCache({ name: freshName(), onFailure: error => failures.push(error) });
    const broken = points(0n, 1);
    cache.write('a', { ...broken, columns: { ...broken.columns, x: new Float64Array(1) } });
    cache.write('a', points(5n, 1));
    await cache.flush();

    expect(failures).toHaveLength(1);
    expect(await cache.read('a', EVERYTHING)).toEqual([]);
  });
});

describe('the IndexedDB cache and segments that begin at the same moment', () => {
  it('keeps both: a shorter one written later does not take the place of a longer one', async () => {
    const cache = indexedDbCache({ name: freshName() });
    cache.write('a', points(0n, 100));
    await cache.flush();
    cache.write('a', points(0n, 10));
    await cache.flush();

    const found = await cache.read('a', { start: 50n, end: 60n });

    expect(found.map(segment => segment.columns.length)).toEqual([100]);
  });
});

describe('the IndexedDB cache over a database laid out by an earlier version', () => {
  it('lays it out anew instead of failing', async () => {
    const name = freshName();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('segments', { keyPath: 'id' });
        request.result.createObjectStore('meta');
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    const failures: unknown[] = [];
    const cache = indexedDbCache({ name, onFailure: error => failures.push(error) });

    cache.write('a', points(0n, 3));
    await cache.flush();

    expect(await cache.read('a', EVERYTHING)).toHaveLength(1);
    expect(failures).toEqual([]);
  });
});
