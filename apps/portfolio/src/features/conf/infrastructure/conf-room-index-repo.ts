import type { ISO, TDatabaseErrorCallback } from '@frozik/utils';
import {
  createDB,
  EDatabaseErrorCallbackType,
  getDatabaseVersion,
  getNowISO8601,
} from '@frozik/utils';
import type { DBSchema, IDBPDatabase } from 'idb';
import { isNil, orderBy } from 'lodash-es';
import type { IConfRoomIndexEntry, RoomId } from '../domain';

const DATABASE_NAME = 'frozik-conf';
const CURRENT_DATABASE_VERSION = 1;

const ROOMS_TABLE_NAME = 'rooms';
const ROOMS_LAST_VISITED_INDEX = 'by-last-visited-at';

const ROOM_ID_FIELD: keyof IDBConfRoomEntry = 'roomId';
const ROOM_LAST_VISITED_FIELD: keyof IDBConfRoomEntry = 'lastVisitedAt';
const ROOM_CREATED_AT_FIELD: keyof IDBConfRoomEntry = 'createdAt';

/**
 * Persisted schema for a conf room. Intentionally minimal — conf is
 * anonymous and the lobby only needs to remember which rooms the user
 * has visited to populate the "recent rooms" list.
 */
interface IDBConfRoomEntry {
  readonly roomId: RoomId;
  readonly createdAt: ISO;
  readonly lastVisitedAt: ISO;
}

interface IConfRoomsDB extends DBSchema {
  [ROOMS_TABLE_NAME]: {
    value: IDBConfRoomEntry;
    key: RoomId;
    indexes: {
      [ROOMS_LAST_VISITED_INDEX]: ISO;
    };
  };
}

/**
 * Repository contract the application layer depends on. Uses plain
 * `Promise`-returning methods because the recent-rooms list is read on
 * mount and refreshed imperatively — there is no reactive cross-tab
 * subscription requirement for this data.
 */
export interface IConfRoomIndexRepo {
  list(): Promise<readonly IConfRoomIndexEntry[]>;
  add(roomId: RoomId, createdAt: ISO): Promise<void>;
  touchVisited(roomId: RoomId): Promise<void>;
  remove(roomId: RoomId): Promise<void>;
}

export async function createConfRoomIndexRepo(
  onDatabaseError?: TDatabaseErrorCallback
): Promise<IConfRoomIndexRepo> {
  const errorCallback: TDatabaseErrorCallback =
    onDatabaseError ??
    (async () => {
      /* no-op */
    });

  const database = await openConfRoomIndexDatabase(errorCallback);

  return {
    async list(): Promise<readonly IConfRoomIndexEntry[]> {
      const transaction = database.transaction(ROOMS_TABLE_NAME, 'readonly');
      const store = transaction.objectStore(ROOMS_TABLE_NAME);
      const rows = await store.getAll();
      return orderBy(rows, ROOM_CREATED_AT_FIELD, 'desc').map(toDomainEntry);
    },

    async add(roomId: RoomId, createdAt: ISO): Promise<void> {
      const row: IDBConfRoomEntry = {
        roomId,
        createdAt,
        lastVisitedAt: createdAt,
      };
      await database.put(ROOMS_TABLE_NAME, row);
    },

    async touchVisited(roomId: RoomId): Promise<void> {
      const existing = await database.get(ROOMS_TABLE_NAME, roomId);
      if (isNil(existing)) {
        return;
      }
      const updated: IDBConfRoomEntry = {
        ...existing,
        lastVisitedAt: getNowISO8601(),
      };
      await database.put(ROOMS_TABLE_NAME, updated);
    },

    async remove(roomId: RoomId): Promise<void> {
      await database.delete(ROOMS_TABLE_NAME, roomId);
    },
  };
}

async function openConfRoomIndexDatabase(
  dbCallback: TDatabaseErrorCallback
): Promise<IDBPDatabase<IConfRoomsDB>> {
  const currentVersion = (await getDatabaseVersion(DATABASE_NAME)) ?? 0;
  const requestedVersion = Math.max(currentVersion, CURRENT_DATABASE_VERSION);

  return createDB<IConfRoomsDB>(DATABASE_NAME, requestedVersion, {
    async blocked() {
      await dbCallback(EDatabaseErrorCallbackType.Blocked);
    },
    async blocking() {
      await dbCallback(EDatabaseErrorCallbackType.Blocking);
    },
    async terminated() {
      await dbCallback(EDatabaseErrorCallbackType.Terminated);
    },
    upgrade(database: IDBPDatabase<IConfRoomsDB>, oldVersion: number) {
      if (oldVersion < 1) {
        const store = database.createObjectStore(ROOMS_TABLE_NAME, {
          keyPath: ROOM_ID_FIELD,
        });
        store.createIndex(ROOMS_LAST_VISITED_INDEX, ROOM_LAST_VISITED_FIELD);
      }
    },
  });
}

function toDomainEntry(row: IDBConfRoomEntry): IConfRoomIndexEntry {
  return {
    roomId: row.roomId,
    createdAt: row.createdAt,
    lastVisitedAt: row.lastVisitedAt,
  };
}
