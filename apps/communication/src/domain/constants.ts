// Protocol invariants. Tunable values (timeouts, caps, ttl) come from TOML
// config and are NOT hardcoded here.

// RFC 4122 v4 UUID — used by `assertRoomId` and `assertUserId`.
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Display name length constraints (after `String.prototype.trim`).
export const DISPLAY_NAME_MIN_LENGTH = 1;
export const DISPLAY_NAME_MAX_LENGTH = 50;
