import { describe, expect, it } from 'vitest';
import { RoomFullError, TooManyTabsError } from './errors';
import type { Identity } from './Identity';
import type { RoomLimits } from './Room';
import { Room } from './Room';
import type { DisplayName, RoomId, UserId } from './types';

const ROOM_ID = '11111111-2222-4333-8444-555555555555' as RoomId;

const LIMITS: RoomLimits = { maxListeners: 3, maxTabsPerUser: 2 };

function makeIdentity(userId: string, socketId: string, displayName = 'D'): Identity {
  return {
    userId: userId as UserId,
    displayName: displayName as DisplayName,
    socketId,
  };
}

describe('Room', () => {
  it('adds members up to maxListeners', () => {
    const room = new Room(ROOM_ID, LIMITS);
    expect(room.addMember('s1', makeIdentity('u1', 's1')).ok).toBe(true);
    expect(room.addMember('s2', makeIdentity('u2', 's2')).ok).toBe(true);
    expect(room.addMember('s3', makeIdentity('u3', 's3')).ok).toBe(true);
    expect(room.count()).toBe(3);
  });

  it('rejects with RoomFullError when over capacity', () => {
    const room = new Room(ROOM_ID, LIMITS);
    room.addMember('s1', makeIdentity('u1', 's1'));
    room.addMember('s2', makeIdentity('u2', 's2'));
    room.addMember('s3', makeIdentity('u3', 's3'));
    const result = room.addMember('s4', makeIdentity('u4', 's4'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(RoomFullError);
    }
  });

  it('rejects with TooManyTabsError when same user opens too many tabs', () => {
    const room = new Room(ROOM_ID, LIMITS);
    expect(room.addMember('s1', makeIdentity('u1', 's1')).ok).toBe(true);
    expect(room.addMember('s2', makeIdentity('u1', 's2')).ok).toBe(true);
    const result = room.addMember('s3', makeIdentity('u1', 's3'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(TooManyTabsError);
    }
  });

  it('removeMember frees a slot', () => {
    const room = new Room(ROOM_ID, LIMITS);
    room.addMember('s1', makeIdentity('u1', 's1'));
    room.addMember('s2', makeIdentity('u2', 's2'));
    room.removeMember('s1');
    expect(room.count()).toBe(1);
    expect(room.getMember('s1')).toBeUndefined();
    expect(room.getMember('s2')).toBeDefined();
  });
});
