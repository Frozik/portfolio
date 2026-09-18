import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import { isNil } from 'lodash-es';

import type { SavedWorld, WorldRepository } from '../application/ports/world-repository';

/** A database of its own: the numbered levels kept their progress in `space-golf`, which nothing reads any more. */
const DATABASE_NAME = 'space-golf-world';
const DATABASE_VERSION = 1;
const WORLD_STORE = 'world';
/** One player, one world. */
const CURRENT_KEY = 'current';

interface SpaceGolfDbSchema extends DBSchema {
  [WORLD_STORE]: {
    key: string;
    value: SavedWorld;
  };
}

/** Keeps the world — its sectors, the ball, the cup and the counters — in IndexedDB. */
export function createIndexedDBWorldRepository(
  databaseName: string = DATABASE_NAME
): WorldRepository {
  let databasePromise: Promise<IDBPDatabase<SpaceGolfDbSchema>> | undefined;

  const openDatabase = (): Promise<IDBPDatabase<SpaceGolfDbSchema>> => {
    if (isNil(databasePromise)) {
      const opening = openDB<SpaceGolfDbSchema>(databaseName, DATABASE_VERSION, {
        upgrade(upgrading) {
          if (!upgrading.objectStoreNames.contains(WORLD_STORE)) {
            upgrading.createObjectStore(WORLD_STORE);
          }
        },
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

  return {
    async load(): Promise<SavedWorld | undefined> {
      const database = await openDatabase();
      return database.get(WORLD_STORE, CURRENT_KEY);
    },
    async save(world: SavedWorld): Promise<void> {
      const database = await openDatabase();
      await database.put(WORLD_STORE, world, CURRENT_KEY);
    },
    async clear(): Promise<void> {
      const database = await openDatabase();
      await database.delete(WORLD_STORE, CURRENT_KEY);
    },
  };
}
