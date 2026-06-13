import type { TDatabaseErrorCallback } from '@frozik/utils/database';
import { openVersionedDatabase } from '@frozik/utils/database';
import { getNowISO8601 } from '@frozik/utils/date/now';
import type { ISO } from '@frozik/utils/date/types';
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
  readonly pictureUrl?: string;
  readonly lastSeenAt: ISO;
}

interface IDBUserRow {
  readonly clientId: ClientId;
  readonly name: string;
  readonly pictureUrl?: string;
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
        pictureUrl: profile.pictureUrl,
        lastSeenAt: profile.lastSeenAt,
      });
    },
  };
}

function openUserDirectoryDatabase(
  dbCallback: TDatabaseErrorCallback
): Promise<IDBPDatabase<IUserDirectoryDB>> {
  return openVersionedDatabase<IUserDirectoryDB>(
    DATABASE_NAME,
    CURRENT_DATABASE_VERSION,
    (database, oldVersion) => {
      if (oldVersion < 1) {
        database.createObjectStore(USERS_TABLE_NAME, { keyPath: 'clientId' });
      }
    },
    dbCallback
  );
}

function toProfile(row: IDBUserRow): IUserProfile {
  return {
    clientId: row.clientId,
    name: row.name,
    pictureUrl: row.pictureUrl,
    lastSeenAt: row.lastSeenAt,
  };
}

export function nowIso(): ISO {
  return getNowISO8601();
}
