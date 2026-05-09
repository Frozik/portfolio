import { describe, expect, it } from 'vitest';
import type { RoomAllowlistEntry } from './config/sections/room-section';
import { checkRoomAllowlist } from './RoomAllowlistChecker';

const ROOM_ID = '11111111-2222-4333-8444-555555555555';
const OTHER_ROOM_ID = '22222222-3333-4444-8555-666666666666';

describe('checkRoomAllowlist', () => {
  it('allows when allowlist is empty (backward-compatible default)', () => {
    const result = checkRoomAllowlist(ROOM_ID, 'user-1', []);
    expect(result.ok).toBe(true);
  });

  it('allows when no entry matches the roomId', () => {
    const allowlist: ReadonlyArray<RoomAllowlistEntry> = [
      { roomId: OTHER_ROOM_ID, userIds: ['user-1'] },
    ];
    const result = checkRoomAllowlist(ROOM_ID, 'user-2', allowlist);
    expect(result.ok).toBe(true);
  });

  it('allows listed userIds for a populated entry', () => {
    const allowlist: ReadonlyArray<RoomAllowlistEntry> = [
      { roomId: ROOM_ID, userIds: ['sub-1', 'sub-2'] },
    ];
    const result = checkRoomAllowlist(ROOM_ID, 'sub-2', allowlist);
    expect(result.ok).toBe(true);
  });

  it('rejects unlisted userIds for a populated entry', () => {
    const allowlist: ReadonlyArray<RoomAllowlistEntry> = [
      { roomId: ROOM_ID, userIds: ['sub-1', 'sub-2'] },
    ];
    const result = checkRoomAllowlist(ROOM_ID, 'sub-3', allowlist);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('forbidden-room');
    }
  });

  it('treats an entry with empty userIds as no enforcement for that room', () => {
    const allowlist: ReadonlyArray<RoomAllowlistEntry> = [{ roomId: ROOM_ID, userIds: [] }];
    const result = checkRoomAllowlist(ROOM_ID, 'sub-99', allowlist);
    expect(result.ok).toBe(true);
  });

  it('unions userIds across multiple entries for the same roomId', () => {
    const allowlist: ReadonlyArray<RoomAllowlistEntry> = [
      { roomId: ROOM_ID, userIds: ['sub-1'] },
      { roomId: ROOM_ID, userIds: ['sub-2', 'sub-3'] },
    ];
    expect(checkRoomAllowlist(ROOM_ID, 'sub-1', allowlist).ok).toBe(true);
    expect(checkRoomAllowlist(ROOM_ID, 'sub-3', allowlist).ok).toBe(true);
    expect(checkRoomAllowlist(ROOM_ID, 'sub-4', allowlist).ok).toBe(false);
  });

  it('does not affect other rooms when one room has restrictions', () => {
    const allowlist: ReadonlyArray<RoomAllowlistEntry> = [{ roomId: ROOM_ID, userIds: ['sub-1'] }];
    const result = checkRoomAllowlist(OTHER_ROOM_ID, 'sub-99', allowlist);
    expect(result.ok).toBe(true);
  });
});
