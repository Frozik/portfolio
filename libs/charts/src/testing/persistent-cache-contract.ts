import { describe, expect, it } from 'vitest';

import { columnsOf } from '../core/series/columns';
import type { IPersistentCache, IStoredSegment } from '../data/timeseries/cache/persistent-cache';
import { TIME_MAX, TIME_MIN } from '../data/timeseries/interval';
import { timesOf } from '../data/timeseries/time-columns';

export interface IPersistentCacheContractOptions {
  create(): IPersistentCache;
  /** Resolves once what was written can be read: caches may write with a delay. */
  settle(cache: IPersistentCache): Promise<void>;
}

const EVERYTHING = { start: TIME_MIN, end: TIME_MAX };

function segment(start: bigint, count: number): IStoredSegment {
  return {
    start,
    end: start + BigInt(count) - 1n,
    columns: columnsOf({
      shape: 'point',
      points: Array.from({ length: count }, (_, index) => ({
        x: start + BigInt(index),
        value: index,
      })),
    }),
  };
}

/** What a time series relies on in any persistent cache: one suite for every implementation of the port (§4.7). */
export function describePersistentCache(
  name: string,
  options: IPersistentCacheContractOptions
): void {
  describe(`persistent cache contract: ${name}`, () => {
    it('reads nothing for a series it has never seen', async () => {
      expect(await options.create().read('unknown', EVERYTHING)).toEqual([]);
    });

    it('gives back the interval and the elements it was given', async () => {
      const cache = options.create();
      cache.write('a', segment(100n, 3));
      await options.settle(cache);

      const [found] = await cache.read('a', EVERYTHING);

      expect(found).toMatchObject({ start: 100n, end: 102n });
      expect(Array.from(timesOf(found.columns))).toEqual([100n, 101n, 102n]);
    });

    it('keeps series apart by their keys', async () => {
      const cache = options.create();
      cache.write('a', segment(0n, 3));
      cache.write('b', segment(0n, 5));
      await options.settle(cache);

      expect((await cache.read('a', EVERYTHING)).map(found => found.columns.length)).toEqual([3]);
      expect((await cache.read('b', EVERYTHING)).map(found => found.columns.length)).toEqual([5]);
    });

    it('reads the segments that reach into the interval, and only them', async () => {
      const cache = options.create();
      cache.write('a', segment(0n, 10));
      cache.write('a', segment(100n, 10));
      cache.write('a', segment(200n, 10));
      await options.settle(cache);

      const found = await cache.read('a', { start: 105n, end: 150n });

      expect(found.map(each => each.start)).toEqual([100n]);
    });

    it('keeps an interval known to be empty', async () => {
      const cache = options.create();
      cache.write('a', { ...segment(50n, 0), end: 80n });
      await options.settle(cache);

      const [found] = await cache.read('a', EVERYTHING);

      expect(found).toMatchObject({ start: 50n, end: 80n });
      expect(found.columns.length).toBe(0);
    });
  });
}
