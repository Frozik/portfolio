import type { ISO } from '@frozik/utils/date/types';
import { isSyncedValueDescriptor } from '@frozik/utils/value-descriptors/utils';
import { when } from 'mobx';

import type { IConfRoomIndexRepo } from '../domain/ports/room-index-repo';
import type { IConfRoomIndexEntry, ParticipantId, RoomId } from '../domain/types';
import { ConfLobbyStore } from './ConfLobbyStore';

const ME = 'me' as ParticipantId;
const OTHER = 'other' as ParticipantId;

function createMemoryRepo(): IConfRoomIndexRepo & {
  readonly rows: Map<RoomId, IConfRoomIndexEntry>;
} {
  const rows = new Map<RoomId, IConfRoomIndexEntry>();
  return {
    rows,
    list: () => Promise.resolve([...rows.values()]),
    add(roomId, createdAt, ownerParticipantId) {
      rows.set(roomId, { roomId, createdAt, lastVisitedAt: createdAt, ownerParticipantId });
      return Promise.resolve();
    },
    touchVisited(roomId) {
      const now = '2026-09-05T00:00:00Z' as ISO;
      const existing = rows.get(roomId);
      rows.set(
        roomId,
        existing === undefined
          ? { roomId, createdAt: now, lastVisitedAt: now, ownerParticipantId: undefined }
          : { ...existing, lastVisitedAt: now }
      );
      return Promise.resolve();
    },
    remove(roomId) {
      rows.delete(roomId);
      return Promise.resolve();
    },
  };
}

async function whenRoomsSynced(store: ConfLobbyStore): Promise<readonly IConfRoomIndexEntry[]> {
  await when(() => isSyncedValueDescriptor(store.rooms));
  return isSyncedValueDescriptor(store.rooms) ? store.rooms.value : [];
}

describe('ConfLobbyStore', () => {
  it('creates a room owned by the local participant and lists it', async () => {
    const repo = createMemoryRepo();
    const store = new ConfLobbyStore(Promise.resolve(repo), ME);

    const roomId = store.createRoom();
    const rooms = await whenRoomsSynced(store);

    expect(rooms.map(room => room.roomId)).toEqual([roomId]);
    expect(store.isOwnedByMe(rooms[0])).toBe(true);
  });

  it('remembers a room joined by link without claiming ownership', async () => {
    const repo = createMemoryRepo();
    const store = new ConfLobbyStore(Promise.resolve(repo), ME);
    const roomId = 'linked' as RoomId;

    await store.touchVisited(roomId);
    const rooms = await whenRoomsSynced(store);

    expect(rooms[0]?.ownerParticipantId).toBeUndefined();
    expect(store.isOwnedByMe(rooms[0])).toBe(false);
  });

  it('tells rooms created by someone else apart from its own', async () => {
    const repo = createMemoryRepo();
    await repo.add('theirs' as RoomId, '2026-09-05T00:00:00Z' as ISO, OTHER);
    const store = new ConfLobbyStore(Promise.resolve(repo), ME);

    await store.loadRooms();
    const rooms = await whenRoomsSynced(store);

    expect(store.isOwnedByMe(rooms[0])).toBe(false);
  });

  it('forgets a room on request', async () => {
    const repo = createMemoryRepo();
    const store = new ConfLobbyStore(Promise.resolve(repo), ME);
    const roomId = store.createRoom();
    await whenRoomsSynced(store);

    await store.forgetRoom(roomId);

    expect(repo.rows.size).toBe(0);
    expect(store.rooms.value).toEqual([]);
  });
});
