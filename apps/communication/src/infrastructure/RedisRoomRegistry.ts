import type { Identity } from '../domain/Identity';
import type { IRoomRegistry, RoomLimits } from '../domain/IRoomRegistry';
import { Room } from '../domain/Room';
import type { RoomId, SocketId } from '../domain/types';

/**
 * Minimal subset of the `redis` (node-redis v5) client surface used by the
 * registry. Modeled as a port so unit tests can pass an in-process fake
 * instead of standing up a real Redis. The real `RedisClientType` from the
 * `redis` package satisfies this shape structurally.
 */
export interface IRedisLike {
  hSet(key: string, field: string, value: string): Promise<number>;
  hDel(key: string, fields: string | string[]): Promise<number>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hLen(key: string): Promise<number>;
  del(key: string | string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  /**
   * Async generator yielding batches of keys matching `MATCH`. Mirrors
   * node-redis v5's `scanIterator`, which yields **arrays** of keys rather
   * than individual keys per iteration.
   */
  scanIterator(options: { MATCH: string; COUNT?: number }): AsyncIterable<string[]>;
}

export type RedisRoomRegistryParams = {
  client: IRedisLike;
  /**
   * Prefix prepended to all keys. Defaults to `comm:`. The registry
   * stores rooms under `<keyPrefix>room:<roomId>`.
   */
  keyPrefix?: string;
};

/**
 * Room hashes expire unless a live node keeps refreshing them. Without a TTL
 * a crashed node leaves its sockets in the hash forever ("ghost members");
 * `hydrate` then resurrects them on every `ensure`, counting toward
 * max-listeners until the room is permanently `room/full`.
 */
const ROOM_TTL_SECONDS = 300;
/** How often live nodes re-arm the TTL of the rooms they host. */
const TTL_HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * Room subclass that writes membership changes through to Redis.
 *
 * Inherits all aggregate-level invariants from `Room` (max-listeners,
 * max-tabs-per-user dedup) — only the persistence side-effect is added.
 */
class RedisBackedRoom extends Room {
  public constructor(
    roomId: RoomId,
    limits: RoomLimits,
    private readonly client: IRedisLike,
    private readonly key: string
  ) {
    super(roomId, limits);
  }

  public override addMember(socketId: SocketId, identity: Identity): ReturnType<Room['addMember']> {
    const result = super.addMember(socketId, identity);
    if (result.ok) {
      void this.client
        .hSet(this.key, socketId, JSON.stringify(identity))
        .then(() => this.client.expire(this.key, ROOM_TTL_SECONDS))
        .catch(() => undefined);
    }
    return result;
  }

  public override removeMember(socketId: SocketId): void {
    super.removeMember(socketId);
    void this.client.hDel(this.key, socketId).catch(() => undefined);
  }

  /**
   * Internal: hydrate from a Redis snapshot without writing back.
   */
  public hydrateMember(socketId: SocketId, identity: Identity): void {
    if (super.getMember(socketId) !== undefined) {
      return;
    }
    super.addMember(socketId, identity);
  }
}

/**
 * Multi-node room registry backed by Redis hashes.
 *
 * Storage layout: one hash per room, key `<prefix>room:<roomId>`, fields
 * `socketId → JSON.stringify(Identity)`. The local-node `Room` aggregate
 * caches membership and writes through every mutation to Redis; on
 * `ensure` we kick off a best-effort hydration from Redis so members
 * already attached to another node become visible (e.g. when the local
 * node receives a `signal:publish` for a room someone else owns).
 *
 * Trade-offs: the synchronous `IRoomRegistry` interface is preserved
 * (mirrors `InMemoryRoomRegistry`), so we cannot block on Redis in the
 * fast path. Cluster-wide consistency is therefore eventual (one
 * round-trip behind), which is fine for the rate limits and presence
 * accounting we use this for. `getMembersFromRedis` is provided for
 * call sites that need the authoritative view (and can await).
 *
 * `count()` returns the local-node count — `countFromRedis()` returns
 * the cluster-wide count via `SCAN`. The Prometheus
 * `communication_active_rooms` metric uses the local-node sample by
 * design (one timeseries per node).
 */
export class RedisRoomRegistry implements IRoomRegistry {
  private readonly client: IRedisLike;
  private readonly keyPrefix: string;
  private readonly localRooms = new Map<RoomId, RedisBackedRoom>();
  private readonly ttlHeartbeat: ReturnType<typeof setInterval>;

  public constructor(params: RedisRoomRegistryParams) {
    this.client = params.client;
    this.keyPrefix = params.keyPrefix ?? 'comm:';
    this.ttlHeartbeat = setInterval(() => {
      this.refreshRoomTtls();
    }, TTL_HEARTBEAT_INTERVAL_MS);
    // Node timers expose unref(); browser-typed test environments don't —
    // the timer must never keep a process alive on its own.
    (this.ttlHeartbeat as unknown as { unref?: () => void }).unref?.();
  }

  /** Stops the TTL heartbeat. Call on shutdown. */
  public dispose(): void {
    clearInterval(this.ttlHeartbeat);
  }

  public ensure(roomId: RoomId, limits: RoomLimits): Room {
    let room = this.localRooms.get(roomId);
    if (room === undefined) {
      room = new RedisBackedRoom(roomId, limits, this.client, this.roomKey(roomId));
      this.localRooms.set(roomId, room);
    }
    void this.hydrate(roomId, room);
    return room;
  }

  public release(roomId: RoomId, socketId: SocketId): void {
    const room = this.localRooms.get(roomId);
    if (room === undefined) {
      void this.client.hDel(this.roomKey(roomId), socketId).catch(() => undefined);
      return;
    }
    room.removeMember(socketId);
    if (room.count() === 0) {
      this.localRooms.delete(roomId);
      void this.client.del(this.roomKey(roomId)).catch(() => undefined);
    }
  }

  public getRoom(roomId: RoomId): Room | null {
    return this.localRooms.get(roomId) ?? null;
  }

  public count(): number {
    return this.localRooms.size;
  }

  public async countFromRedis(): Promise<number> {
    let total = 0;
    for await (const batch of this.client.scanIterator({ MATCH: `${this.keyPrefix}room:*` })) {
      total += batch.length;
    }
    return total;
  }

  public async getMembersFromRedis(roomId: RoomId): Promise<ReadonlyArray<Identity>> {
    const fields = await this.client.hGetAll(this.roomKey(roomId));
    const out: Identity[] = [];
    for (const value of Object.values(fields)) {
      try {
        out.push(JSON.parse(value) as Identity);
      } catch {
        // Skip corrupted entries — defensive against mismatched serializers.
      }
    }
    return out;
  }

  private roomKey(roomId: RoomId): string {
    return `${this.keyPrefix}room:${roomId}`;
  }

  private refreshRoomTtls(): void {
    for (const roomId of this.localRooms.keys()) {
      void this.client.expire(this.roomKey(roomId), ROOM_TTL_SECONDS).catch(() => undefined);
    }
  }

  private async hydrate(roomId: RoomId, room: RedisBackedRoom): Promise<void> {
    let fields: Record<string, string>;
    try {
      fields = await this.client.hGetAll(this.roomKey(roomId));
    } catch {
      return;
    }
    for (const [socketId, raw] of Object.entries(fields)) {
      let identity: Identity;
      try {
        identity = JSON.parse(raw) as Identity;
      } catch {
        continue;
      }
      room.hydrateMember(socketId, identity);
    }
  }
}
