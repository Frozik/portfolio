import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import { isNil } from 'lodash-es';

import type { ProgressRepository } from '../application/ports/progress-repository';
import type { Progress } from '../domain/progress';

const DATABASE_NAME = 'space-golf';
const DATABASE_VERSION = 1;
const PROGRESS_STORE = 'progress';
/** One player, one record. */
const CURRENT_KEY = 'current';

interface SpaceGolfDbSchema extends DBSchema {
  [PROGRESS_STORE]: {
    key: string;
    value: Progress;
  };
}

/** Keeps the player's level and stroke totals in IndexedDB. */
export function createIndexedDBProgressRepository(
  databaseName: string = DATABASE_NAME
): ProgressRepository {
  let databasePromise: Promise<IDBPDatabase<SpaceGolfDbSchema>> | undefined;

  const openDatabase = (): Promise<IDBPDatabase<SpaceGolfDbSchema>> => {
    if (isNil(databasePromise)) {
      const opening = openDB<SpaceGolfDbSchema>(databaseName, DATABASE_VERSION, {
        upgrade(upgrading) {
          if (!upgrading.objectStoreNames.contains(PROGRESS_STORE)) {
            upgrading.createObjectStore(PROGRESS_STORE);
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
    async load(): Promise<Progress | undefined> {
      const database = await openDatabase();
      return database.get(PROGRESS_STORE, CURRENT_KEY);
    },
    async save(progress: Progress): Promise<void> {
      const database = await openDatabase();
      await database.put(PROGRESS_STORE, progress, CURRENT_KEY);
    },
  };
}
