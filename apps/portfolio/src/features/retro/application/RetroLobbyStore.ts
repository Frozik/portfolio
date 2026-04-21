import type { ISO, ValueDescriptor } from '@frozik/utils';
import {
  convertErrorToFail,
  createSyncedValueDescriptor,
  createUnsyncedValueDescriptor,
  EMPTY_VD,
} from '@frozik/utils';
import { Temporal } from '@js-temporal/polyfill';
import { makeAutoObservable, runInAction } from 'mobx';

import type { ClientId, ERetroTemplate, IRoomIndexEntry, RoomId } from '../domain/types';
import type { IRoomIndexRepo } from '../infrastructure/room-index-repo';
import type { UserDirectoryStore } from './UserDirectoryStore';

const RECENT_ROOMS_LIMIT = 50;
const INITIAL_PARTICIPANT_COUNT = 0;

export interface ICreateRoomParams {
  readonly name: string;
  readonly template: ERetroTemplate;
  readonly votesPerParticipant: number;
}

export interface ICreateRoomContext {
  readonly ownerClientId: ClientId;
}

export interface IJoinedRoomSnapshot {
  readonly roomId: RoomId;
  readonly name: string;
  readonly template: ERetroTemplate;
  readonly createdAt: ISO;
  readonly facilitatorClientId: ClientId | null;
  readonly facilitatorName: string;
  readonly participantCount: number;
}

export class RetroLobbyStore {
  rooms: ValueDescriptor<readonly IRoomIndexEntry[], readonly IRoomIndexEntry[]> = EMPTY_VD;
  isCreateDialogOpen = false;

  /**
   * Create-params stashed per roomId when the user creates a retro in the
   * lobby. Consumed by `useRoomStore` on first mount so the newly-navigated
   * Room can run `initRetroDoc` and mark the creator as facilitator.
   */
  private readonly pendingCreate = new Map<RoomId, ICreateRoomParams>();

  constructor(
    private readonly repoPromise: Promise<IRoomIndexRepo>,
    private readonly directory: UserDirectoryStore
  ) {
    makeAutoObservable(
      this,
      {
        repoPromise: false,
        directory: false,
        pendingCreate: false,
      } as never,
      { autoBind: true }
    );
  }

  async loadRooms(): Promise<void> {
    try {
      const repo = await this.repoPromise;
      const list = await repo.listRecent(RECENT_ROOMS_LIMIT);

      runInAction(() => {
        this.rooms = createSyncedValueDescriptor<readonly IRoomIndexEntry[]>(list);
      });
    } catch (error) {
      const fail = convertErrorToFail(error instanceof Error ? error : new Error(String(error)));

      runInAction(() => {
        this.rooms = createUnsyncedValueDescriptor<readonly IRoomIndexEntry[]>([], fail);
      });
    }
  }

  async deleteRoom(roomId: RoomId): Promise<void> {
    const repo = await this.repoPromise;
    await repo.remove(roomId);
    await this.loadRooms();
  }

  openCreateDialog(): void {
    this.isCreateDialogOpen = true;
  }

  closeCreateDialog(): void {
    this.isCreateDialogOpen = false;
  }

  createRoom(params: ICreateRoomParams, context: ICreateRoomContext): RoomId {
    const roomId = crypto.randomUUID() as RoomId;
    const nowIso = Temporal.Now.instant().toString() as ISO;

    const entry: IRoomIndexEntry = {
      roomId,
      name: params.name,
      template: params.template,
      createdAt: nowIso,
      lastVisitedAt: nowIso,
      participantCount: INITIAL_PARTICIPANT_COUNT,
      ownerClientId: context.ownerClientId,
    };

    this.pendingCreate.set(roomId, params);
    void this.persistNewRoom(entry);

    return roomId;
  }

  /**
   * Upsert an entry for a retro the user joined by link (not created). The
   * `ownerClientId` is preserved from the existing row — if the current
   * user created the retro earlier, their ownership flag stays intact.
   * Otherwise the facilitator's clientId is used as the owner pointer so
   * the lobby row can resolve the display name through the directory.
   */
  async upsertJoinedRoom(snapshot: IJoinedRoomSnapshot): Promise<void> {
    const repo = await this.repoPromise;
    const nowIso = Temporal.Now.instant().toString() as ISO;
    const existing = (await repo.listRecent(Number.MAX_SAFE_INTEGER)).find(
      entry => entry.roomId === snapshot.roomId
    );

    const ownerClientId = existing?.ownerClientId ?? snapshot.facilitatorClientId;

    if (snapshot.facilitatorClientId !== null && snapshot.facilitatorName.trim().length > 0) {
      void this.directory.seedIfMissing({
        clientId: snapshot.facilitatorClientId,
        name: snapshot.facilitatorName,
        color: '#64748b',
      });
    }

    const entry: IRoomIndexEntry = {
      roomId: snapshot.roomId,
      name: snapshot.name,
      template: snapshot.template,
      createdAt: snapshot.createdAt,
      lastVisitedAt: nowIso,
      participantCount: snapshot.participantCount,
      ownerClientId,
    };

    if (
      existing !== undefined &&
      existing.name === entry.name &&
      existing.template === entry.template &&
      existing.createdAt === entry.createdAt &&
      existing.participantCount === entry.participantCount &&
      existing.ownerClientId === entry.ownerClientId
    ) {
      // Skip write when only lastVisitedAt would change — still touch it so
      // the recent-rooms ordering updates.
      await repo.upsert(entry);
      return;
    }

    await repo.upsert(entry);
    await this.loadRooms();
  }

  /**
   * Read the create-params stashed for `roomId`, if any. Non-destructive so
   * StrictMode double-mount and navigation round-trips still find the
   * params — `initRetroDoc` on the consumer side is idempotent, so repeated
   * reads are safe. Entries live until page reload.
   */
  getPendingCreate(roomId: RoomId): ICreateRoomParams | null {
    return this.pendingCreate.get(roomId) ?? null;
  }

  dispose(): void {}

  private async persistNewRoom(entry: IRoomIndexEntry): Promise<void> {
    const repo = await this.repoPromise;
    await repo.upsert(entry);
    await this.loadRooms();
  }
}
