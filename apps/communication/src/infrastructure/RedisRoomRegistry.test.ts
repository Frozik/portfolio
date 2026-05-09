import { describe, expect, it } from 'vitest';
import type { Identity } from '../domain/Identity';
import type { RoomLimits } from '../domain/Room';
import type { DisplayName, RoomId, UserId } from '../domain/types';
import type { IRedisLike } from './RedisRoomRegistry';
import { RedisRoomRegistry } from './RedisRoomRegistry';

const ROOM_ID = '11111111-2222-4333-8444-555555555555' as RoomId;
const ROOM_ID_2 = '22222222-3333-4444-8555-666666666666' as RoomId;
const LIMITS: RoomLimits = { maxListeners: 5, maxTabsPerUser: 2 };

function makeIdentity(socketId: string, userId = 'u1'): Identity {
  return {
    userId: userId as UserId,
    displayName: 'Alice' as DisplayName,
    socketId,
  };
}

/**
 * In-process fake of the redis (node-redis v5) hash + scan API. Sufficient
 * for the registry's `hSet` / `hDel` / `hGetAll` / `del` / `scanIterator`
 * surface; no network, no encoding, no event loop ticks beyond the
 * microtask boundary the registry awaits.
 */
class FakeRedis implements IRedisLike {
  private readonly hashes = new Map<string, Map<string, string>>();

  async hSet(key: string, field: string, value: string): Promise<number> {
    let bucket = this.hashes.get(key);
    if (bucket === undefined) {
      bucket = new Map<string, string>();
      this.hashes.set(key, bucket);
    }
    const existed = bucket.has(field);
    bucket.set(field, value);
    return existed ? 0 : 1;
  }

  async hDel(key: string, fields: string | string[]): Promise<number> {
    const bucket = this.hashes.get(key);
    if (bucket === undefined) {
      return 0;
    }
    const list = Array.isArray(fields) ? fields : [fields];
    let count = 0;
    for (const field of list) {
      if (bucket.delete(field)) {
        count += 1;
      }
    }
    if (bucket.size === 0) {
      this.hashes.delete(key);
    }
    return count;
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    const bucket = this.hashes.get(key);
    if (bucket === undefined) {
      return {};
    }
    return Object.fromEntries(bucket);
  }

  async hLen(key: string): Promise<number> {
    return this.hashes.get(key)?.size ?? 0;
  }

  async del(key: string | string[]): Promise<number> {
    const list = Array.isArray(key) ? key : [key];
    let count = 0;
    for (const item of list) {
      if (this.hashes.delete(item)) {
        count += 1;
      }
    }
    return count;
  }

  async *scanIterator(options: { MATCH: string; COUNT?: number }): AsyncIterable<string[]> {
    const pattern = options.MATCH;
    // Trivial glob matcher — only `*` is needed by the registry.
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    const matches: string[] = [];
    for (const key of this.hashes.keys()) {
      if (regex.test(key)) {
        matches.push(key);
      }
    }
    if (matches.length > 0) {
      yield matches;
    }
  }
}

async function flush(): Promise<void> {
  // Allow the registry's fire-and-forget hSet/hDel awaits to resolve.
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

describe('RedisRoomRegistry', () => {
  it('ensure creates a room handle synchronously', () => {
    const fake = new FakeRedis();
    const registry = new RedisRoomRegistry({ client: fake, keyPrefix: 'test:' });
    const room = registry.ensure(ROOM_ID, LIMITS);
    expect(room.count()).toBe(0);
    expect(registry.getRoom(ROOM_ID)).toBe(room);
  });

  it('addMember writes through to Redis', async () => {
    const fake = new FakeRedis();
    const registry = new RedisRoomRegistry({ client: fake, keyPrefix: 'test:' });
    const room = registry.ensure(ROOM_ID, LIMITS);
    const result = room.addMember('socket-1', makeIdentity('socket-1'));
    expect(result.ok).toBe(true);
    await flush();
    const stored = await fake.hGetAll(`test:room:${ROOM_ID}`);
    expect(Object.keys(stored)).toEqual(['socket-1']);
    const parsed = JSON.parse(stored['socket-1'] ?? '{}') as Identity;
    expect(parsed.userId).toBe('u1');
  });

  it('release removes the field from Redis and deletes empty rooms', async () => {
    const fake = new FakeRedis();
    const registry = new RedisRoomRegistry({ client: fake, keyPrefix: 'test:' });
    const room = registry.ensure(ROOM_ID, LIMITS);
    room.addMember('socket-1', makeIdentity('socket-1'));
    await flush();
    registry.release(ROOM_ID, 'socket-1');
    await flush();
    expect(registry.getRoom(ROOM_ID)).toBeNull();
    const stored = await fake.hGetAll(`test:room:${ROOM_ID}`);
    expect(Object.keys(stored)).toHaveLength(0);
  });

  it('hydrates membership from Redis on ensure for a foreign-node room', async () => {
    // Pre-populate Redis as if another node already wrote a member.
    const fake = new FakeRedis();
    const remoteIdentity = makeIdentity('foreign-socket', 'u-other');
    await fake.hSet(`test:room:${ROOM_ID}`, 'foreign-socket', JSON.stringify(remoteIdentity));

    const registry = new RedisRoomRegistry({ client: fake, keyPrefix: 'test:' });
    const room = registry.ensure(ROOM_ID, LIMITS);
    // Hydration is async — let it finish.
    await flush();
    expect(room.getMember('foreign-socket')).toEqual(remoteIdentity);
  });

  it('countFromRedis reports cluster-wide room count via SCAN', async () => {
    const fake = new FakeRedis();
    await fake.hSet(`test:room:${ROOM_ID}`, 'socket-1', JSON.stringify(makeIdentity('socket-1')));
    await fake.hSet(`test:room:${ROOM_ID_2}`, 'socket-2', JSON.stringify(makeIdentity('socket-2')));
    // A non-room key must not be counted.
    await fake.hSet('test:other:foo', 'bar', 'baz');

    const registry = new RedisRoomRegistry({ client: fake, keyPrefix: 'test:' });
    expect(await registry.countFromRedis()).toBe(2);
  });

  it('getMembersFromRedis returns the authoritative member list', async () => {
    const fake = new FakeRedis();
    const identityA = makeIdentity('s-a', 'u-a');
    const identityB = makeIdentity('s-b', 'u-b');
    await fake.hSet(`test:room:${ROOM_ID}`, 's-a', JSON.stringify(identityA));
    await fake.hSet(`test:room:${ROOM_ID}`, 's-b', JSON.stringify(identityB));

    const registry = new RedisRoomRegistry({ client: fake, keyPrefix: 'test:' });
    const members = await registry.getMembersFromRedis(ROOM_ID);
    expect(members).toHaveLength(2);
    expect(members.map(member => member.userId).sort()).toEqual(['u-a', 'u-b']);
  });

  it('release without a local room handle still drops the field from Redis', async () => {
    const fake = new FakeRedis();
    await fake.hSet(
      `test:room:${ROOM_ID}`,
      'orphan-socket',
      JSON.stringify(makeIdentity('orphan-socket'))
    );
    const registry = new RedisRoomRegistry({ client: fake, keyPrefix: 'test:' });
    registry.release(ROOM_ID, 'orphan-socket');
    await flush();
    const stored = await fake.hGetAll(`test:room:${ROOM_ID}`);
    expect(Object.keys(stored)).toHaveLength(0);
  });

  it('respects the keyPrefix option', async () => {
    const fake = new FakeRedis();
    const registry = new RedisRoomRegistry({ client: fake, keyPrefix: 'app42:' });
    const room = registry.ensure(ROOM_ID, LIMITS);
    room.addMember('s-1', makeIdentity('s-1'));
    await flush();
    expect(await fake.hLen(`app42:room:${ROOM_ID}`)).toBe(1);
    expect(await fake.hLen(`test:room:${ROOM_ID}`)).toBe(0);
  });
});
