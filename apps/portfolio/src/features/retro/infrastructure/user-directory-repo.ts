import { createDB, getDatabaseVersion } from '@frozik/utils/database';
import { getNowISO8601 } from '@frozik/utils/date/now';
import type { ISO } from '@frozik/utils/date/types';
import type { TDatabaseErrorCallback } from '@frozik/utils/rx/database';
import { EDatabaseErrorCallbackType } from '@frozik/utils/rx/database';
import type { DBSchema, IDBPDatabase } from 'idb';

import type { ClientId } from '../domain/types';

const DATABASE_NAME = 'retro-user-directory';
const CURRENT_DATABASE_VERSION = 1;
const USERS_TABLE_NAME = 'users';

/**
 * A single known user. Populated from three sources (in priority order):
 *   1. Local `IdentityStore` — the current browser's own identity.
 *   2. Remote awareness events — live presence from peers in any room.
 *   3. `meta.facilitatorName` bootstrap — seed value when joining a room
 *      whose facilitator is offline and not yet in awareness.
 */
export interface IUserProfile {
  readonly clientId: ClientId;
  readonly name: string;
  readonly color: string;
  readonly lastSeenAt: ISO;
}

interface IDBUserRow {
  readonly clientId: ClientId;
  readonly name: string;
  readonly color: string;
  readonly lastSeenAt: ISO;
}

interface IUserDirectoryDB extends DBSchema {
  [USERS_TABLE_NAME]: {
    value: IDBUserRow;
    key: ClientId;
  };
}

export interface IUserDirectoryRepo {
  listAll(): Promise<IUserProfile[]>;
  upsert(profile: IUserProfile): Promise<void>;
}

export async function createUserDirectoryRepo(
  onDatabaseError?: TDatabaseErrorCallback
): Promise<IUserDirectoryRepo> {
  const errorCallback: TDatabaseErrorCallback =
    onDatabaseError ??
    (async () => {
      /* no-op */
    });

  const database = await openUserDirectoryDatabase(errorCallback);

  return {
    async listAll(): Promise<IUserProfile[]> {
      const rows = await database.getAll(USERS_TABLE_NAME);
      return rows.map(toProfile);
    },

    async upsert(profile: IUserProfile): Promise<void> {
      await database.put(USERS_TABLE_NAME, {
        clientId: profile.clientId,
        name: profile.name,
        color: profile.color,
        lastSeenAt: profile.lastSeenAt,
      });
    },
  };
}

async function openUserDirectoryDatabase(
  dbCallback: TDatabaseErrorCallback
): Promise<IDBPDatabase<IUserDirectoryDB>> {
  const currentVersion = (await getDatabaseVersion(DATABASE_NAME)) ?? 0;
  const requestedVersion = Math.max(currentVersion, CURRENT_DATABASE_VERSION);

  return createDB<IUserDirectoryDB>(DATABASE_NAME, requestedVersion, {
    async blocked() {
      await dbCallback(EDatabaseErrorCallbackType.Blocked);
    },
    async blocking() {
      await dbCallback(EDatabaseErrorCallbackType.Blocking);
    },
    async terminated() {
      await dbCallback(EDatabaseErrorCallbackType.Terminated);
    },
    upgrade(database: IDBPDatabase<IUserDirectoryDB>, oldVersion: number) {
      if (oldVersion < 1) {
        database.createObjectStore(USERS_TABLE_NAME, { keyPath: 'clientId' });
      }
    },
  });
}

function toProfile(row: IDBUserRow): IUserProfile {
  return {
    clientId: row.clientId,
    name: row.name,
    color: row.color,
    lastSeenAt: row.lastSeenAt,
  };
}

export function nowIso(): ISO {
  return getNowISO8601();
}
