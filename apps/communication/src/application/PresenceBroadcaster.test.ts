import type { IRoomPresenceEvent } from '@frozik/communication-protocol/messages';
import { describe, expect, it } from 'vitest';
import type { Identity } from '../domain/Identity';
import { Room } from '../domain/Room';
import type { DisplayName, RoomId, UserId } from '../domain/types';
import type { IPresenceTransport } from './ports/IPresenceTransport';
import { PresenceBroadcaster } from './PresenceBroadcaster';

const ROOM_ID = '11111111-2222-4333-8444-555555555555' as RoomId;

function makeIdentity(userId: string, socketId: string, displayName?: string): Identity {
  return {
    userId: userId as UserId,
    displayName: (displayName ?? `name-${userId}`) as DisplayName,
    socketId,
  };
}

function makeTransport(): IPresenceTransport & {
  events: Array<{ roomId: RoomId; event: IRoomPresenceEvent }>;
} {
  const events: Array<{ roomId: RoomId; event: IRoomPresenceEvent }> = [];
  return {
    events,
    emitPresence(roomId, event) {
      events.push({ roomId, event });
    },
  };
}

describe('PresenceBroadcaster', () => {
  it('dedupes multiple tabs of the same user', () => {
    const room = new Room(ROOM_ID, { maxListeners: 10, maxTabsPerUser: 4 });
    room.addMember('s1', makeIdentity('u1', 's1', 'Old Name'));
    room.addMember('s2', makeIdentity('u1', 's2', 'New Name'));
    room.addMember('s3', makeIdentity('u2', 's3'));

    const transport = makeTransport();
    const broadcaster = new PresenceBroadcaster({ presenceTransport: transport });
    broadcaster.onJoin(ROOM_ID, room);

    expect(transport.events).toHaveLength(1);
    const event = transport.events[0]?.event;
    expect(event?.socketCount).toBe(3);
    expect(event?.users).toHaveLength(2);
    // Last-write-wins: u1's displayName should be the most recently
    // added one.
    const u1 = event?.users.find(u => u.userId === 'u1');
    expect(u1?.displayName).toBe('New Name');
  });

  it('reflects an empty room', () => {
    const room = new Room(ROOM_ID, { maxListeners: 10, maxTabsPerUser: 4 });
    const transport = makeTransport();
    const broadcaster = new PresenceBroadcaster({ presenceTransport: transport });
    broadcaster.onLeave(ROOM_ID, room);
    expect(transport.events[0]?.event).toEqual({ socketCount: 0, users: [] });
  });
});
