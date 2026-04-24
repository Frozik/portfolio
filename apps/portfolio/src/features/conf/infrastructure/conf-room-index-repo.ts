import { createDB, getDatabaseVersion } from '@frozik/utils/database';
import { getNowISO8601 } from '@frozik/utils/date/now';
import type { ISO } from '@frozik/utils/date/types';
import type { TDatabaseErrorCallback } from '@frozik/utils/rx/database';
import { EDatabaseErrorCallbackType } from '@frozik/utils/rx/database';
import type { DBSchema, IDBPDatabase } from 'idb';
import { isNil, orderBy } from 'lodash-es';
import type { IConfRoomIndexEntry, ParticipantId, RoomId } from '../domain/types';

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
  readonly ownerParticipantId?: ParticipantId | null;
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
  add(roomId: RoomId, createdAt: ISO, ownerParticipantId: ParticipantId): Promise<void>;
  /**
   * Upsert a visit marker. If a row for `roomId` already exists, only
   * `lastVisitedAt` is updated — `createdAt` and `ownerParticipantId` are
   * preserved so the creator label stays stable across visits. If the row
   * is missing (first time joining a room by link), a fresh row is
   * inserted with `ownerParticipantId = null`.
   */
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

    async add(roomId: RoomId, createdAt: ISO, ownerParticipantId: ParticipantId): Promise<void> {
      const row: IDBConfRoomEntry = {
        roomId,
        createdAt,
        lastVisitedAt: createdAt,
        ownerParticipantId,
      };
      await database.put(ROOMS_TABLE_NAME, row);
    },

    async touchVisited(roomId: RoomId): Promise<void> {
      const existing = await database.get(ROOMS_TABLE_NAME, roomId);
      const nowIso = getNowISO8601();
      if (isNil(existing)) {
        const fresh: IDBConfRoomEntry = {
          roomId,
          createdAt: nowIso,
          lastVisitedAt: nowIso,
          ownerParticipantId: null,
        };
        await database.put(ROOMS_TABLE_NAME, fresh);
        return;
      }
      const updated: IDBConfRoomEntry = {
        ...existing,
        lastVisitedAt: nowIso,
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
    ownerParticipantId: row.ownerParticipantId ?? null,
  };
}
