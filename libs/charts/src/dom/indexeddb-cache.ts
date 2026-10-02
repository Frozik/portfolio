import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import type { TShape } from '../core/series/shape';
import type { IPersistentCache, IStoredSegment } from '../data/timeseries/cache/persistent-cache';
import { columnsFrom, valueColumnsOf } from '../data/timeseries/column-buffer';
import type { IInterval } from '../data/timeseries/interval';
import { intersects } from '../data/timeseries/interval';
import { timesOf } from '../data/timeseries/time-columns';

/** Raised whenever the object stores change: an older database is emptied and laid out anew. */
const SCHEMA_VERSION = 2;
const DATA_VERSION_KEY = 'dataVersion';
const DEFAULT_MAX_BYTES = 200 * 1024 * 1024;
/** Writes wait this long and go in one transaction: a live stream must not become a stream of transactions. */
const WRITE_DELAY_MS = 500;

export interface IIndexedDbCacheOptions {
  /** The database name: one per application is enough, series are told apart by their keys. */
  readonly name: string;
  /** Changing it discards everything stored: for when history on the server was recomputed after all. */
  readonly version?: number;
  /** The budget on disk; the segments used longest ago go first. */
  readonly maxBytes?: number;
  /** Segments older than this, milliseconds, are not read. */
  readonly maxAgeMs?: number;
  /** The cache gave up — private mode, quota, a failed transaction — and is off until the page is reloaded. */
  readonly onFailure?: (error: unknown) => void;
}

export interface IIndexedDbCache extends IPersistentCache {
  /** Writes what is waiting, now: before the page goes away, and in tests. */
  flush(): Promise<void>;
}

/** What is known of a stored segment without loading it: finding and evicting never touch the columns. */
interface IEntry {
  readonly id: string;
  readonly series: string;
  /** Decimal: a bigint is not a valid IndexedDB key. */
  readonly start: string;
  readonly end: string;
  readonly bytes: number;
  readonly writtenAt: number;
  readonly usedAt: number;
}

interface IPayload {
  readonly shape: TShape;
  readonly x: BigInt64Array;
  readonly values: readonly Float64Array[];
}

interface ICacheSchema extends DBSchema {
  entries: { key: string; value: IEntry; indexes: { series: string } };
  payloads: { key: string; value: IPayload };
  meta: { key: string; value: number };
}

interface IWaiting {
  readonly entry: IEntry;
  readonly payload: IPayload;
}

function nowMs(): number {
  return Temporal.Now.instant().epochMilliseconds;
}

function intervalOf(entry: IEntry): IInterval {
  return { start: BigInt(entry.start), end: BigInt(entry.end) };
}

function waitingOf(series: string, segment: IStoredSegment): IWaiting {
  // Copies: the columns may be views of a buffer that keeps growing.
  const x = timesOf(segment.columns).slice();
  const values = valueColumnsOf(segment.columns).map(column => column.slice());
  const now = nowMs();
  return {
    entry: {
      id: `${series}|${segment.start}|${segment.end}`,
      series,
      start: String(segment.start),
      end: String(segment.end),
      bytes: x.byteLength + values.reduce((sum, column) => sum + column.byteLength, 0),
      writtenAt: now,
      usedAt: now,
    },
    payload: { shape: segment.columns.shape, x, values },
  };
}

/** The persistent cache of time series in IndexedDB: columns stored as they are, typed arrays and all (§4.7). */
export function indexedDbCache(options: IIndexedDbCacheOptions): IIndexedDbCache {
  const { name, version = 1, maxBytes = DEFAULT_MAX_BYTES, maxAgeMs } = options;
  let disabled = false;
  let waiting: IWaiting[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const fail = (error: unknown): void => {
    if (!disabled) {
      disabled = true;
      waiting = [];
      options.onFailure?.(error);
    }
  };

  const open = async (): Promise<IDBPDatabase<ICacheSchema>> => {
    const database = await openDB<ICacheSchema>(name, SCHEMA_VERSION, {
      upgrade(upgraded) {
        // A cache holds nothing that cannot be read again: an older layout is dropped, not migrated.
        for (const stale of [...upgraded.objectStoreNames]) {
          upgraded.deleteObjectStore(stale);
        }
        upgraded.createObjectStore('entries', { keyPath: 'id' }).createIndex('series', 'series');
        upgraded.createObjectStore('payloads');
        upgraded.createObjectStore('meta');
      },
    });
    if ((await database.get('meta', DATA_VERSION_KEY)) !== version) {
      const reset = database.transaction(['entries', 'payloads', 'meta'], 'readwrite');
      await reset.objectStore('entries').clear();
      await reset.objectStore('payloads').clear();
      await reset.objectStore('meta').put(version, DATA_VERSION_KEY);
      await reset.done;
    }
    return database;
  };
  let opened: Promise<IDBPDatabase<ICacheSchema>> | undefined;
  const database = (): Promise<IDBPDatabase<ICacheSchema>> => {
    opened ??= open();
    return opened;
  };

  /** Over the budget, the segments used longest ago are deleted. */
  const evict = async (connection: IDBPDatabase<ICacheSchema>): Promise<void> => {
    const transaction = connection.transaction(['entries', 'payloads'], 'readwrite');
    const entries = await transaction.objectStore('entries').getAll();
    let total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
    for (const entry of entries.toSorted((first, second) => first.usedAt - second.usedAt)) {
      if (total <= maxBytes) {
        break;
      }
      total -= entry.bytes;
      await transaction.objectStore('entries').delete(entry.id);
      await transaction.objectStore('payloads').delete(entry.id);
    }
    await transaction.done;
  };

  const flush = async (): Promise<void> => {
    clearTimeout(timer);
    timer = undefined;
    const written = waiting;
    waiting = [];
    if (disabled || written.length === 0) {
      return;
    }
    try {
      const connection = await database();
      const transaction = connection.transaction(['entries', 'payloads'], 'readwrite');
      await Promise.all(
        written.flatMap(({ entry, payload }) => [
          transaction.objectStore('entries').put(entry),
          transaction.objectStore('payloads').put(payload, entry.id),
        ])
      );
      await transaction.done;
      await evict(connection);
    } catch (error) {
      fail(error);
    }
  };

  const isFresh = (entry: IEntry): boolean =>
    isNil(maxAgeMs) || nowMs() - entry.writtenAt <= maxAgeMs;

  return {
    async read(seriesKey: string, interval: IInterval): Promise<readonly IStoredSegment[]> {
      if (disabled) {
        return [];
      }
      try {
        const connection = await database();
        const transaction = connection.transaction(['entries', 'payloads'], 'readwrite');
        const entries = await transaction.objectStore('entries').index('series').getAll(seriesKey);
        const usedAt = nowMs();
        const found: IStoredSegment[] = [];
        for (const entry of entries) {
          if (!isFresh(entry) || !intersects(intervalOf(entry), interval)) {
            continue;
          }
          const payload = await transaction.objectStore('payloads').get(entry.id);
          if (!isNil(payload)) {
            await transaction.objectStore('entries').put({ ...entry, usedAt });
            found.push({
              ...intervalOf(entry),
              columns: columnsFrom(payload.shape, payload.x, payload.values),
            });
          }
        }
        await transaction.done;
        return found;
      } catch (error) {
        fail(error);
        return [];
      }
    },

    write(seriesKey: string, segment: IStoredSegment): void {
      if (disabled) {
        return;
      }
      try {
        waiting.push(waitingOf(seriesKey, segment));
        timer ??= setTimeout(() => void flush(), WRITE_DELAY_MS);
      } catch (error) {
        fail(error);
      }
    },

    flush,
  };
}
