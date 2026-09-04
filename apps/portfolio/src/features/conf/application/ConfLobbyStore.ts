import { getNowISO8601 } from '@frozik/utils/date/now';
import type { ISO } from '@frozik/utils/date/types';
import { convertErrorToFail } from '@frozik/utils/value-descriptors/fails/utils';
import type { ValueDescriptor } from '@frozik/utils/value-descriptors/types';
import {
  createSyncedValueDescriptor,
  createUnsyncedValueDescriptor,
  EMPTY_VD,
} from '@frozik/utils/value-descriptors/utils';
import { makeAutoObservable, runInAction } from 'mobx';
import type { IConfRoomIndexRepo } from '../domain/ports/room-index-repo';
import type { IConfRoomIndexEntry, ParticipantId, RoomId } from '../domain/types';
import { getOrCreateParticipantId } from '../infrastructure/participant-identity';

/**
 * The conf lobby: which rooms this browser created or visited. The repo is
 * a promise because IndexedDB opens asynchronously; `rooms` stays empty until
 * it resolves.
 */
export class ConfLobbyStore {
  rooms: ValueDescriptor<readonly IConfRoomIndexEntry[], readonly IConfRoomIndexEntry[]> = EMPTY_VD;

  readonly localParticipantId: ParticipantId;

  constructor(
    private readonly repoPromise: Promise<IConfRoomIndexRepo>,
    localParticipantId: ParticipantId = getOrCreateParticipantId()
  ) {
    // Minted on the first lobby mount so reconnect detection already works on the first room.
    this.localParticipantId = localParticipantId;

    makeAutoObservable<ConfLobbyStore, 'repoPromise' | 'localParticipantId'>(
      this,
      {
        repoPromise: false,
        localParticipantId: false,
      },
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

  /** Returns the new id at once; the repo write and the list reload run in the background. */
  createRoom(): RoomId {
    const roomId = crypto.randomUUID() as RoomId;
    const createdAt: ISO = getNowISO8601();
    void this.persistNewRoom(roomId, createdAt);
    return roomId;
  }

  isOwnedByMe(entry: IConfRoomIndexEntry): boolean {
    return entry.ownerParticipantId === this.localParticipantId;
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

  dispose(): void {}

  private async persistNewRoom(roomId: RoomId, createdAt: ISO): Promise<void> {
    const repo = await this.repoPromise;
    await repo.add(roomId, createdAt, this.localParticipantId);
    await this.loadRooms();
  }
}
