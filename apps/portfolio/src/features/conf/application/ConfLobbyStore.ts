import type { ISO, ValueDescriptor } from '@frozik/utils';
import {
  convertErrorToFail,
  createSyncedValueDescriptor,
  createUnsyncedValueDescriptor,
  EMPTY_VD,
  getNowISO8601,
} from '@frozik/utils';
import { makeAutoObservable, runInAction } from 'mobx';

import type { IConfRoomIndexEntry, ParticipantId, RoomId } from '../domain';
import type { IConfRoomIndexRepo } from '../infrastructure';
import { getOrCreateParticipantId } from '../infrastructure';

/**
 * MobX store for the conf lobby. Mirrors `RetroLobbyStore` but is
 * intentionally thinner — conf rooms have no name, template or owner,
 * so the lobby only knows how to remember which rooms the user created
 * or visited.
 *
 * The repo is supplied as a promise because the IndexedDB connection
 * opens asynchronously; the store degrades gracefully while the repo
 * is still resolving (the `rooms` descriptor stays empty).
 */
export class ConfLobbyStore {
  rooms: ValueDescriptor<readonly IConfRoomIndexEntry[], readonly IConfRoomIndexEntry[]> = EMPTY_VD;

  readonly localParticipantId: ParticipantId;

  constructor(private readonly repoPromise: Promise<IConfRoomIndexRepo>) {
    // Materialise the persistent participant id on first lobby mount so
    // the user has a stable identity before they ever enter a room —
    // that way reconnect detection works the very first time they drop
    // and rejoin, instead of only on their second room visit.
    this.localParticipantId = getOrCreateParticipantId();

    makeAutoObservable(
      this,
      {
        repoPromise: false,
        localParticipantId: false,
      } as never,
      { autoBind: true }
    );
  }

  async loadRooms(): Promise<void> {
    try {
      const repo = await this.repoPromise;
      const list = await repo.list();

      runInAction(() => {
        this.rooms = createSyncedValueDescriptor<readonly IConfRoomIndexEntry[]>(list);
      });
    } catch (error) {
      const fail = convertErrorToFail(error instanceof Error ? error : new Error(String(error)));

      runInAction(() => {
        this.rooms = createUnsyncedValueDescriptor<readonly IConfRoomIndexEntry[]>([], fail);
      });
    }
  }

  /**
   * Create a fresh conf room, persist it and return the id to the caller
   * so it can navigate to `/conf/:roomId`. Creation is non-blocking —
   * the repo write runs in the background and the room list reloads
   * once it completes.
   */
  createRoom(): RoomId {
    const roomId = crypto.randomUUID() as RoomId;
    const createdAt: ISO = getNowISO8601();
    void this.persistNewRoom(roomId, createdAt);
    return roomId;
  }

  isOwnedByMe(entry: IConfRoomIndexEntry): boolean {
    return (
      entry.ownerParticipantId !== null && entry.ownerParticipantId === this.localParticipantId
    );
  }

  async touchVisited(roomId: RoomId): Promise<void> {
    const repo = await this.repoPromise;
    await repo.touchVisited(roomId);
    await this.loadRooms();
  }

  async forgetRoom(roomId: RoomId): Promise<void> {
    const repo = await this.repoPromise;
    await repo.remove(roomId);
    await this.loadRooms();
  }

  dispose(): void {
    // No live subscriptions; provided so the RootStore registry can
    // dispose the entry uniformly alongside other feature stores.
  }

  private async persistNewRoom(roomId: RoomId, createdAt: ISO): Promise<void> {
    const repo = await this.repoPromise;
    await repo.add(roomId, createdAt, this.localParticipantId);
    await this.loadRooms();
  }
}
