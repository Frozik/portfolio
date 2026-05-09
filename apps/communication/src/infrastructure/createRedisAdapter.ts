import { createAdapter } from '@socket.io/redis-adapter';
import type { RedisClientType } from 'redis';
import { createClient } from 'redis';

export type RedisAdapterFactoryParams = {
  url: string;
  keyPrefix?: string;
};

export type RedisAdapterFactoryResult = {
  /** Drop-in for `io.adapter(...)` so cross-node broadcasts fan out. */
  adapterFactory: ReturnType<typeof createAdapter>;
  /**
   * Cleanup hook — disconnects both pub and sub clients. The adapter does
   * not register a process-exit hook itself; bootstrap calls this on
   * graceful shutdown after `io.close()`.
   */
  close: () => Promise<void>;
};

/**
 * Build a Socket.IO Redis adapter for cross-node broadcast fan-out.
 *
 * Two clients are required (one in subscribe mode, one for publishing /
 * regular commands). `@socket.io/redis-adapter` is wire-compatible with
 * `node-redis` v4+ via the duck-typed `pubClient` / `subClient` params,
 * so we instantiate plain `createClient` instances and wire them in.
 *
 * The `keyPrefix` is forwarded as the adapter's `key` so all pub/sub
 * channels live under `${prefix}socket.io` — this matches the prefix used
 * by `RedisRoomRegistry` so a single `redis-cli MONITOR` view shows both
 * sides of the system.
 */
export async function createRedisAdapterFactory(
  params: RedisAdapterFactoryParams
): Promise<RedisAdapterFactoryResult> {
  const pubClient: RedisClientType = createClient({ url: params.url });
  const subClient: RedisClientType = pubClient.duplicate();

  // Both must be connected before the adapter is attached, otherwise the
  // first broadcast races with the connection handshake and gets dropped.
  await Promise.all([pubClient.connect(), subClient.connect()]);

  const adapterKey = `${params.keyPrefix ?? 'comm:'}socket.io`;
  const adapterFactory = createAdapter(pubClient, subClient, { key: adapterKey });

  const close = async (): Promise<void> => {
    // `quit()` waits for in-flight commands to drain (vs `disconnect()` which
    // is a hard close). On graceful shutdown we prefer drain — the adapter's
    // outgoing pub messages may still be flushing.
    await Promise.allSettled([pubClient.quit(), subClient.quit()]);
  };

  return { adapterFactory, close };
}
