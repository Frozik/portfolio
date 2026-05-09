import { z } from 'zod';

/**
 * Redis configuration (v2 multi-node scaling).
 *
 * When `enabled` is `false` (the default), the server uses
 * `InMemoryRoomRegistry` and a stock single-node Socket.IO adapter — no
 * Redis dependency at runtime. When `enabled` is `true`, bootstrap swaps
 * in `RedisRoomRegistry` and the `@socket.io/redis-adapter` so cross-node
 * broadcasts fan out via Redis pub/sub.
 *
 * `key_prefix` is shared between the room registry (hash keys) and the
 * adapter (pub/sub channels) so a single `redis-cli MONITOR` shows both
 * sides of the system under one prefix.
 */
export const RedisSectionSchema = z.object({
  enabled: z.boolean(),
  url: z.string().min(1),
  key_prefix: z.string().min(1),
});

export type RedisSection = z.infer<typeof RedisSectionSchema>;
