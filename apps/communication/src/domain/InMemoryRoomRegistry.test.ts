import { describe, expect, it } from 'vitest';
import type { Identity } from './Identity';
import { InMemoryRoomRegistry } from './InMemoryRoomRegistry';
import type { RoomLimits } from './Room';
import type { DisplayName, RoomId, UserId } from './types';

const ROOM_ID = '11111111-2222-4333-8444-555555555555' as RoomId;
const LIMITS: RoomLimits = { maxListeners: 5, maxTabsPerUser: 2 };

function makeIdentity(socketId: string, userId = 'u1'): Identity {
  return {
    userId: userId as UserId,
    displayName: 'D' as DisplayName,
    socketId,
  };
}

describe('InMemoryRoomRegistry', () => {
  it('ensure creates a room when absent', () => {
    const registry = new InMemoryRoomRegistry();
    const room = registry.ensure(ROOM_ID, LIMITS);
    expect(room.count()).toBe(0);
    expect(registry.getRoom(ROOM_ID)).toBe(room);
  });

  it('ensure returns the same room on second call', () => {
    const registry = new InMemoryRoomRegistry();
    const first = registry.ensure(ROOM_ID, LIMITS);
    const second = registry.ensure(ROOM_ID, LIMITS);
    expect(first).toBe(second);
  });

  it('release removes member and deletes empty room', () => {
    const registry = new InMemoryRoomRegistry();
    const room = registry.ensure(ROOM_ID, LIMITS);
    room.addMember('s1', makeIdentity('s1'));
    expect(room.count()).toBe(1);
    registry.release(ROOM_ID, 's1');
    expect(registry.getRoom(ROOM_ID)).toBeNull();
  });

  it('release is a no-op for unknown rooms', () => {
    const registry = new InMemoryRoomRegistry();
    expect(() => registry.release(ROOM_ID, 's1')).not.toThrow();
  });
});
