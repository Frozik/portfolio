import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import { MAX_STORED_TILES } from '../domain/constants';
import type { TileStore } from '../domain/ports/tile-store';
import type { TileKey } from '../domain/tile-key';

const DATABASE_NAME = 'osm-map-tiles';
const DATABASE_VERSION = 1;
const TILES_STORE = 'tiles';
const ACCESSED_AT_INDEX = 'accessedAt';

interface StoredTile {
  /** Raw PNG bytes: an ArrayBuffer clones into every IndexedDB, a Blob not into every one. */
  readonly bytes: ArrayBuffer;
  readonly type: string;
  /** Epoch milliseconds of the last read or write; the eviction order. */
  readonly accessedAt: number;
}

interface TileStoreSchema extends DBSchema {
  [TILES_STORE]: {
    key: TileKey;
    value: StoredTile;
    indexes: { [ACCESSED_AT_INDEX]: number };
  };
}

function now(): number {
  return Temporal.Now.instant().epochMilliseconds;
}

/**
 * Tiles in IndexedDB, at most `maxTiles` of them: every read refreshes the
 * tile's access time, and a write past the ceiling deletes the tiles read
 * least recently. Storage trouble (private mode, quota) never reaches the
 * map — a failed read is a miss and a failed write is forgotten.
 */
export function createIndexedDBTileStore(
  databaseName: string = DATABASE_NAME,
  maxTiles: number = MAX_STORED_TILES
): TileStore {
  let databasePromise: Promise<IDBPDatabase<TileStoreSchema>> | undefined;
  let knownCount = 0;

  const openDatabase = (): Promise<IDBPDatabase<TileStoreSchema>> => {
    if (isNil(databasePromise)) {
      const opening = openDB<TileStoreSchema>(databaseName, DATABASE_VERSION, {
        upgrade(upgrading) {
          const tiles = upgrading.createObjectStore(TILES_STORE);
          tiles.createIndex(ACCESSED_AT_INDEX, 'accessedAt');
        },
      }).then(async database => {
        knownCount = await database.count(TILES_STORE);
        return database;
      });
      // A failed open must not be remembered: the next attempt may well succeed.
      opening.catch(() => {
        if (databasePromise === opening) {
          databasePromise = undefined;
        }
      });
      databasePromise = opening;
    }
    return databasePromise;
  };

  async function evictLeastRecentlyUsed(
    database: IDBPDatabase<TileStoreSchema>,
    excess: number
  ): Promise<void> {
    const transaction = database.transaction(TILES_STORE, 'readwrite');
    let cursor = await transaction.store.index(ACCESSED_AT_INDEX).openCursor();
    for (let deleted = 0; deleted < excess && cursor !== null; deleted++) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await transaction.done;
  }

  return {
    async get(key: TileKey): Promise<Blob | undefined> {
      try {
        const database = await openDatabase();
        const transaction = database.transaction(TILES_STORE, 'readwrite');
        const stored = await transaction.store.get(key);
        if (stored !== undefined) {
          await transaction.store.put({ ...stored, accessedAt: now() }, key);
        }
        await transaction.done;
        return stored === undefined ? undefined : new Blob([stored.bytes], { type: stored.type });
      } catch {
        return undefined;
      }
    },
    async set(key: TileKey, bytes: Blob): Promise<void> {
      try {
        const buffer = await bytes.arrayBuffer();
        const database = await openDatabase();
        const transaction = database.transaction(TILES_STORE, 'readwrite');
        const existed = (await transaction.store.count(key)) > 0;
        await transaction.store.put({ bytes: buffer, type: bytes.type, accessedAt: now() }, key);
        await transaction.done;
        if (!existed) {
          knownCount++;
        }
        if (knownCount > maxTiles) {
          await evictLeastRecentlyUsed(database, knownCount - maxTiles);
          knownCount = maxTiles;
        }
      } catch {
        // Storage is a cache: a write that fails is not worth a broken map.
      }
    },
  };
}
