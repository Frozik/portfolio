import type { IPersistentCache, IStoredSegment } from '../data/timeseries/cache/persistent-cache';
import { intersects } from '../data/timeseries/interval';

export interface IMemoryPersistentCache extends IPersistentCache {
  /** Everything written, by series key. */
  readonly stored: ReadonlyMap<string, readonly IStoredSegment[]>;
  /** Every read made, oldest first. */
  readonly reads: readonly string[];
}

/** A persistent cache that persists nothing: the port over a map, for tests of what uses it. */
export function memoryPersistentCache(): IMemoryPersistentCache {
  const stored = new Map<string, IStoredSegment[]>();
  const reads: string[] = [];
  return {
    stored,
    reads,
    async read(seriesKey, interval) {
      reads.push(seriesKey);
      return (stored.get(seriesKey) ?? []).filter(segment => intersects(segment, interval));
    },
    write(seriesKey, segment) {
      stored.set(seriesKey, [...(stored.get(seriesKey) ?? []), segment]);
    },
  };
}
