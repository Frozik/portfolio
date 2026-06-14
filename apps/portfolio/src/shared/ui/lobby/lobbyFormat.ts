import { formatISO8601Local } from '@frozik/utils/date/format';
import type { ISO } from '@frozik/utils/date/types';

const ROOM_COUNT_PAD_LENGTH = 2;
const ROOM_COUNT_PAD_CHAR = '0';
const LOCAL_DATETIME_MINUTES_LENGTH = 16;

/**
 * Resolves a room id from raw lobby "join by link" input: accepts either a
 * full room URL (matched by `pattern`, the feature's `/retro/…` or `/conf/…`
 * route) or a bare id pasted directly. Returns `null` for empty input.
 */
export function extractRoomIdFromInput(raw: string, pattern: RegExp): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const match = trimmed.match(pattern);
  if (match !== null) {
    return match[1] ?? null;
  }
  return trimmed;
}

/** Zero-pads the active-room counter shown in the lobby hero ("07", "12"). */
export function formatRoomCount(count: number): string {
  return String(count).padStart(ROOM_COUNT_PAD_LENGTH, ROOM_COUNT_PAD_CHAR);
}

/** Local "YYYY-MM-DD HH:mm" timestamp for a room's `createdAt`. */
export function formatLocalDateTime(iso: ISO): string {
  return formatISO8601Local(iso).slice(0, LOCAL_DATETIME_MINUTES_LENGTH);
}
