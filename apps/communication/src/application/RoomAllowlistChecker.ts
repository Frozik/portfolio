import type { RoomAllowlistEntry } from './config/sections/room-section';
import type { Result } from './Result';
import { err, ok } from './Result';

// Per-room allowlist (v2). Empty allowlist = "no enforcement; allow anyone
// authenticated" (backward compatible default). An entry with no `userIds`
// for a roomId is also treated as "no enforcement for this room" so operators
// can express "this room exists but has no restriction" without removing the
// entry. Listed userIds are matched verbatim against the `sub` claim from the
// verified Google ID token.
export type RoomAllowlistError = 'forbidden-room';

export function checkRoomAllowlist(
  roomId: string,
  userId: string,
  allowlist: ReadonlyArray<RoomAllowlistEntry>
): Result<void, RoomAllowlistError> {
  const entriesForRoom = allowlist.filter(entry => entry.roomId === roomId);
  if (entriesForRoom.length === 0) {
    return ok(undefined);
  }
  // Union of all listed userIds across matching entries — operators can
  // split the same roomId into multiple entries (e.g. one per group) and the
  // user just needs to be listed in any of them.
  const allowedUserIds = new Set<string>();
  for (const entry of entriesForRoom) {
    for (const allowedUserId of entry.userIds) {
      allowedUserIds.add(allowedUserId);
    }
  }
  if (allowedUserIds.size === 0) {
    // No userIds anywhere — treat as "no enforcement for this room".
    return ok(undefined);
  }
  if (!allowedUserIds.has(userId)) {
    return err('forbidden-room');
  }
  return ok(undefined);
}
