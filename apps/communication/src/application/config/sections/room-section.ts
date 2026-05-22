import { z } from 'zod';

const MAX_LISTENERS_UPPER = 10_000;
const RESPONSE_GATHER_TIMEOUT_MIN_MS = 100;
const RESPONSE_GATHER_TIMEOUT_MAX_MS = 600_000;
const MAX_HTTP_BUFFER_BYTES_MAX = 16_777_216; // 16 MiB
const MAX_TABS_PER_USER_MAX = 32;
const MAX_INFLIGHT_DISPATCHES_PER_SOCKET_MAX = 1_024;

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
});

export type RoomSection = z.infer<typeof RoomSectionSchema>;
