import type { IServerConfig } from '../../application/config/server-config-schema';
import type { IRoomRegistry } from '../../domain/IRoomRegistry';
import { createRedisAdapterFactory } from '../../infrastructure/createRedisAdapter';
import { InMemoryRoomRegistry } from '../../infrastructure/InMemoryRoomRegistry';
import { RedisRoomRegistry } from '../../infrastructure/RedisRoomRegistry';

type RedisAdapterFactory = Awaited<ReturnType<typeof createRedisAdapterFactory>>['adapterFactory'];

export type RoomBackend = {
  roomRegistry: IRoomRegistry;
  /** Installed as Socket.IO's adapter so broadcasts fan out via Redis pub/sub; null single-process. */
  adapterFactory: RedisAdapterFactory | null;
  close: () => Promise<void>;
};

/**
 * The room registry and, when the `[redis]` section is enabled, the Socket.IO
 * adapter beside it. Both share the same `key_prefix`, so a single
 * `redis-cli MONITOR` shows the full system state under one prefix; with Redis
 * disabled (the default) the single-process in-memory registry serves alone.
 */
export async function createRoomBackend(redis: IServerConfig['redis']): Promise<RoomBackend> {
  if (!redis.enabled) {
    return {
      roomRegistry: new InMemoryRoomRegistry(),
      adapterFactory: null,
      close: async () => {},
    };
  }

  const { createClient } = await import('redis');
  const redisClient = createClient({ url: redis.url });
  await redisClient.connect();
  const roomRegistry = new RedisRoomRegistry({ client: redisClient, keyPrefix: redis.key_prefix });
  const adapter = await createRedisAdapterFactory({ url: redis.url, keyPrefix: redis.key_prefix });

  return {
    roomRegistry,
    adapterFactory: adapter.adapterFactory,
    close: async (): Promise<void> => {
      roomRegistry.dispose();
      await adapter.close();
      try {
        await redisClient.quit();
      } catch {
        // Already-closed clients throw; ignore.
      }
    },
  };
}
