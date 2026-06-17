import type { DBSchema, IDBPDatabase, OpenDBCallbacks } from 'idb';
import { openDB } from 'idb';

/** IndexedDB lifecycle errors surfaced to a repository's error callback. */
export enum EDatabaseErrorCallbackType {
  Blocked = 'Blocked',
  Blocking = 'Blocking',
  Terminated = 'Terminated',
}

export type TDatabaseErrorCallback = (type: EDatabaseErrorCallbackType) => void | Promise<void>;

export function createDB<Schema extends DBSchema>(
  dbName: string,
  version: number,
  { upgrade, blocked, blocking, terminated }: OpenDBCallbacks<Schema> = {}
): Promise<IDBPDatabase<Schema>> {
  return openDB<Schema>(dbName, version, {
    upgrade(...args) {
      upgrade?.(...args);
    },
    blocking(currentVersion: number, blockedVersion: number | null, event: IDBVersionChangeEvent) {
      blocking?.(currentVersion, blockedVersion, event);
    },
    blocked(currentVersion: number, blockedVersion: number | null, event: IDBVersionChangeEvent) {
      blocked?.(currentVersion, blockedVersion, event);
    },
    terminated() {
      terminated?.();
    },
  }).then(db => {
    db.onversionchange = e => {
      (e.target as IDBDatabase).close();
    };

    return db;
  });
}

export async function getDatabaseVersion(databaseName: string): Promise<undefined | number> {
  try {
    const databases = await self.indexedDB.databases();
    const panelsDatabase = databases.find(({ name }) => name === databaseName);
    return panelsDatabase?.version;
  } catch {
    return undefined;
  }
}

/**
 * Opens (or upgrades) a versioned IndexedDB database, bumping to at least
 * `version` while never downgrading an existing higher version on disk, and
 * routing blocked/blocking/terminated lifecycle events to `onError`.
 *
 * Extracted from the per-feature room/user-directory repositories, which all
 * repeated the same `getDatabaseVersion → Math.max → createDB(... 3 error
 * callbacks ...)` boilerplate — only the `upgrade` body differed.
 */
export async function openVersionedDatabase<Schema extends DBSchema>(
  databaseName: string,
  version: number,
  upgrade: (database: IDBPDatabase<Schema>, oldVersion: number) => void,
  onError?: TDatabaseErrorCallback
): Promise<IDBPDatabase<Schema>> {
  const currentVersion = (await getDatabaseVersion(databaseName)) ?? 0;
  const requestedVersion = Math.max(currentVersion, version);

  return createDB<Schema>(databaseName, requestedVersion, {
    blocked: onError && (() => onError(EDatabaseErrorCallbackType.Blocked)),
    blocking: onError && (() => onError(EDatabaseErrorCallbackType.Blocking)),
    terminated: onError && (() => onError(EDatabaseErrorCallbackType.Terminated)),
    upgrade: (database, oldVersion) => upgrade(database, oldVersion),
  });
}
