import type { Opaque } from '@frozik/utils/types/base';
import { DISPLAY_NAME_MAX_LENGTH, DISPLAY_NAME_MIN_LENGTH, UUID_V4_REGEX } from './constants';
import { InvalidPayloadError } from './errors';

// Branded identifiers — opaque so plain strings cannot be mistakenly used in
// their place.
export type RoomId = Opaque<'RoomId', string>;
export type UserId = Opaque<'UserId', string>;
export type DisplayName = Opaque<'DisplayName', string>;

// Plain `string` aliases (per plan m12 — not branded).
export type SocketId = string;
export type CorrelationId = string;

// Re-export `Milliseconds` so callers can import from the local domain
// barrel-equivalent path without reaching into `@frozik/utils/date/types`
// for what is logically protocol-level.
export type { Milliseconds } from '@frozik/utils/date/types';

export function assertRoomId(raw: string): RoomId {
  if (!UUID_V4_REGEX.test(raw)) {
    throw new InvalidPayloadError('roomId must be a UUID v4');
  }
  return raw as RoomId;
}

export function assertDisplayName(raw: string): DisplayName {
  const trimmed = raw.trim();
  if (trimmed.length < DISPLAY_NAME_MIN_LENGTH || trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new InvalidPayloadError(
      `displayName length must be between ${DISPLAY_NAME_MIN_LENGTH} and ${DISPLAY_NAME_MAX_LENGTH} characters`
    );
  }
  return trimmed as DisplayName;
}
