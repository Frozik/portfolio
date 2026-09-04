import type { TDatabaseErrorCallback } from '@frozik/utils/database';
import { openVersionedDatabase } from '@frozik/utils/database';
import type { ISO } from '@frozik/utils/date/types';
import type { DBSchema, IDBPDatabase } from 'idb';
import { isNil, orderBy } from 'lodash-es';
import type { ClientId, IRoomIndexEntry, RetroPhase, RoomId } from '../domain/types';

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
  readonly template: string;
  readonly createdAt: ISO;
  readonly lastVisitedAt: ISO;
  readonly participantCount: number;
  readonly ownerClientId?: ClientId | null;
  readonly phase?: RetroPhase | null;
  readonly knownParticipantIds?: readonly ClientId[];
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
  /**
   * Read a single room entry by id, or `undefined` when no row exists. A keyed
   * lookup so callers that only need one room avoid scanning the whole store.
   */
  get(roomId: RoomId): Promise<IRoomIndexEntry | undefined>;
  upsert(entry: IRoomIndexEntry): Promise<void>;
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

    async get(roomId: RoomId): Promise<IRoomIndexEntry | undefined> {
      const row = await database.get(ROOMS_TABLE_NAME, roomId);
      return isNil(row) ? undefined : toRoomIndexEntry(row);
    },

    async upsert(entry: IRoomIndexEntry): Promise<void> {
      await database.put(ROOMS_TABLE_NAME, toDatabaseRow(entry));
    },

    async remove(roomId: RoomId): Promise<void> {
      await database.delete(ROOMS_TABLE_NAME, roomId);
    },
  };
}

function openRoomIndexDatabase(
  dbCallback: TDatabaseErrorCallback
): Promise<IDBPDatabase<IRetroRoomsDB>> {
  return openVersionedDatabase<IRetroRoomsDB>(
    DATABASE_NAME,
    CURRENT_DATABASE_VERSION,
    (database, oldVersion) => {
      if (oldVersion < 1) {
        const store = database.createObjectStore(ROOMS_TABLE_NAME, {
          keyPath: ROOM_ID_FIELD,
        });
        store.createIndex(ROOMS_LAST_VISITED_INDEX, ROOM_LAST_VISITED_FIELD);
      }
    },
    dbCallback
  );
}

function toRoomIndexEntry(row: IDBRoomEntry): IRoomIndexEntry {
  return {
    roomId: row.roomId,
    name: row.name,
    template: row.template,
    createdAt: row.createdAt,
    lastVisitedAt: row.lastVisitedAt,
    participantCount: row.participantCount,
    ownerClientId: row.ownerClientId ?? undefined,
    phase: row.phase ?? undefined,
    knownParticipantIds: row.knownParticipantIds ?? [],
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
    phase: entry.phase,
    knownParticipantIds: entry.knownParticipantIds,
  };
}
