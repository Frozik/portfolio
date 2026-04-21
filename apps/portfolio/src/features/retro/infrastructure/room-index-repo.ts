import type { ISO, TDatabaseErrorCallback } from '@frozik/utils';
import {
  createDB,
  EDatabaseErrorCallbackType,
  getDatabaseVersion,
  getNowISO8601,
} from '@frozik/utils';
import type { DBSchema, IDBPDatabase } from 'idb';
import { isNil, orderBy } from 'lodash-es';
import type { ClientId, ERetroTemplate, IRoomIndexEntry, RoomId } from '../domain/types';

const DATABASE_NAME = 'retro-room-index';
const CURRENT_DATABASE_VERSION = 1;

const ROOMS_TABLE_NAME = 'rooms';
const ROOMS_LAST_VISITED_INDEX = 'by-last-visited-at';

const ROOM_ID_FIELD: keyof IDBRoomEntry = 'roomId';
const ROOM_LAST_VISITED_FIELD: keyof IDBRoomEntry = 'lastVisitedAt';
const ROOM_CREATED_AT_FIELD: keyof IDBRoomEntry = 'createdAt';

interface IDBRoomEntry {
  readonly roomId: RoomId;
  readonly name: string;
  readonly template: ERetroTemplate;
  readonly createdAt: ISO;
  readonly lastVisitedAt: ISO;
  readonly participantCount: number;
  readonly ownerClientId?: ClientId | null;
}

interface IRetroRoomsDB extends DBSchema {
  [ROOMS_TABLE_NAME]: {
    value: IDBRoomEntry;
    key: RoomId;
    indexes: {
      [ROOMS_LAST_VISITED_INDEX]: ISO;
    };
  };
}

/**
 * Public surface of the room-index repository. This is a plain-async
 * repository (no RxJS stream) because the recent-rooms list is read on
 * mount and refreshed imperatively after user actions — there is no
 * cross-tab reactive requirement for this data.
 */
export interface IRoomIndexRepo {
  listRecent(limit: number): Promise<IRoomIndexEntry[]>;
  upsert(entry: IRoomIndexEntry): Promise<void>;
  touchVisited(roomId: RoomId, participantCount: number): Promise<void>;
  remove(roomId: RoomId): Promise<void>;
}

export async function createRoomIndexRepo(
  onDatabaseError?: TDatabaseErrorCallback
): Promise<IRoomIndexRepo> {
  const errorCallback: TDatabaseErrorCallback =
    onDatabaseError ??
    (async () => {
      /* no-op */
    });

  const database = await openRoomIndexDatabase(errorCallback);

  return {
    async listRecent(limit: number): Promise<IRoomIndexEntry[]> {
      const transaction = database.transaction(ROOMS_TABLE_NAME, 'readonly');
      const store = transaction.objectStore(ROOMS_TABLE_NAME);
      const rows = await store.getAll();

      return orderBy(rows, ROOM_CREATED_AT_FIELD, 'desc').slice(0, limit).map(toRoomIndexEntry);
    },

    async upsert(entry: IRoomIndexEntry): Promise<void> {
      await database.put(ROOMS_TABLE_NAME, toDatabaseRow(entry));
    },

    async touchVisited(roomId: RoomId, participantCount: number): Promise<void> {
      const existing = await database.get(ROOMS_TABLE_NAME, roomId);

      if (isNil(existing)) {
        return;
      }

      const updated: IDBRoomEntry = {
        ...existing,
        lastVisitedAt: nowIso(),
        participantCount,
      };

      await database.put(ROOMS_TABLE_NAME, updated);
    },

    async remove(roomId: RoomId): Promise<void> {
      await database.delete(ROOMS_TABLE_NAME, roomId);
    },
  };
}

async function openRoomIndexDatabase(
  dbCallback: TDatabaseErrorCallback
): Promise<IDBPDatabase<IRetroRoomsDB>> {
  const currentVersion = (await getDatabaseVersion(DATABASE_NAME)) ?? 0;
  const requestedVersion = Math.max(currentVersion, CURRENT_DATABASE_VERSION);

  return createDB<IRetroRoomsDB>(DATABASE_NAME, requestedVersion, {
    async blocked() {
      await dbCallback(EDatabaseErrorCallbackType.Blocked);
    },
    async blocking() {
      await dbCallback(EDatabaseErrorCallbackType.Blocking);
    },
    async terminated() {
      await dbCallback(EDatabaseErrorCallbackType.Terminated);
    },
    upgrade(database: IDBPDatabase<IRetroRoomsDB>, oldVersion: number) {
      if (oldVersion < 1) {
        const store = database.createObjectStore(ROOMS_TABLE_NAME, {
          keyPath: ROOM_ID_FIELD,
        });

        store.createIndex(ROOMS_LAST_VISITED_INDEX, ROOM_LAST_VISITED_FIELD);
      }
    },
  });
}

function nowIso(): ISO {
  return getNowISO8601();
}

function toRoomIndexEntry(row: IDBRoomEntry): IRoomIndexEntry {
  return {
    roomId: row.roomId,
    name: row.name,
    template: row.template,
    createdAt: row.createdAt,
    lastVisitedAt: row.lastVisitedAt,
    participantCount: row.participantCount,
    ownerClientId: row.ownerClientId ?? null,
  };
}

function toDatabaseRow(entry: IRoomIndexEntry): IDBRoomEntry {
  return {
    roomId: entry.roomId,
    name: entry.name,
    template: entry.template,
    createdAt: entry.createdAt,
    lastVisitedAt: entry.lastVisitedAt,
    participantCount: entry.participantCount,
    ownerClientId: entry.ownerClientId,
  };
}
