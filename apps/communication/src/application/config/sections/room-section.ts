import { z } from 'zod';

const MAX_LISTENERS_UPPER = 10_000;
const RESPONSE_GATHER_TIMEOUT_MIN_MS = 100;
const RESPONSE_GATHER_TIMEOUT_MAX_MS = 600_000;
const MAX_HTTP_BUFFER_BYTES_MAX = 16_777_216; // 16 MiB
const MAX_TABS_PER_USER_MAX = 32;
const MAX_INFLIGHT_DISPATCHES_PER_SOCKET_MAX = 1_024;

// v2: per-room allowlist entry. If `userIds` is empty, the entry is treated as
// "no enforcement for this room" (parsed-but-noop). An entry whose `userIds`
// is non-empty restricts joins to listed Google `sub` values.
export const RoomAllowlistEntrySchema = z.object({
  roomId: z.string().min(1),
  userIds: z.array(z.string().min(1)).readonly(),
});

export type RoomAllowlistEntry = z.infer<typeof RoomAllowlistEntrySchema>;

export const RoomSectionSchema = z.object({
  max_listeners: z.number().int().min(1).max(MAX_LISTENERS_UPPER),
  response_gather_timeout_ms: z
    .number()
    .int()
    .min(RESPONSE_GATHER_TIMEOUT_MIN_MS)
    .max(RESPONSE_GATHER_TIMEOUT_MAX_MS),
  max_http_buffer_bytes: z.number().int().min(1).max(MAX_HTTP_BUFFER_BYTES_MAX),
  max_tabs_per_user: z.number().int().min(1).max(MAX_TABS_PER_USER_MAX),
  max_inflight_dispatches_per_socket: z
    .number()
    .int()
    .min(1)
    .max(MAX_INFLIGHT_DISPATCHES_PER_SOCKET_MAX),
  allowlist: z.array(RoomAllowlistEntrySchema).readonly(),
});

export type RoomSection = z.infer<typeof RoomSectionSchema>;
