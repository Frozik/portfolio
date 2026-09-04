import { convertErrorToFail } from '@frozik/utils/value-descriptors/fails/utils';
import type { ValueDescriptor } from '@frozik/utils/value-descriptors/types';
import {
  createSyncedValueDescriptor,
  createUnsyncedValueDescriptor,
  EMPTY_VD,
  isFailValueDescriptor,
  isSyncedValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import { isNil } from 'lodash-es';
import { computedStruct, makeAutoObservable, observableRef, reaction, runInAction } from 'mobx';

import { PHASE_ORDER } from '../domain/constants';
import type {
  ActionItemId,
  CardId,
  ClientId,
  ColumnId,
  GroupId,
  IParticipant,
  IRetroSnapshot,
  ITemplateConfig,
  RetroPhase,
  RoomId,
} from '../domain/types';
import type { IRetroIdentity } from '../infrastructure/identity-repo';
import { RetroDocGateway } from '../infrastructure/RetroDocGateway';
import type { ISoundPlayer } from '../infrastructure/sound';
import { createSoundPlayer } from '../infrastructure/sound';
import type { IYjsRoomProviders } from '../infrastructure/yjs-providers';
import { PresenceTracker } from './PresenceTracker';
import type { IJoinedRoomSnapshot, RetroLobbyStore } from './RetroLobbyStore';
import { TimerModel } from './TimerModel';
import { ToastModel } from './ToastModel';
import type { UserDirectoryStore } from './UserDirectoryStore';
import { VotingModel } from './VotingModel';

/** Set when the room is opened right after creation: the doc is initialised on first sync. */
export interface IRoomCreateParams {
  readonly name: string;
  readonly template: ITemplateConfig;
  readonly votesPerParticipant: number;
}

/** What the room needs from the user directory: seeding and mirroring profiles. */
export type RoomUserDirectory = Pick<UserDirectoryStore, 'upsert' | 'seedIfMissing'>;
/** What the room needs from the lobby: recording itself in the recent-rooms index. */
export type RoomLobbyIndex = Pick<RetroLobbyStore, 'upsertJoinedRoom'>;

export interface IRoomStoreParams {
  readonly roomId: RoomId;
  readonly identity: IRetroIdentity;
  readonly providers: IYjsRoomProviders;
  readonly createIfMissing: IRoomCreateParams | undefined;
  readonly directory: RoomUserDirectory;
  readonly lobby: RoomLobbyIndex;
  /** Defaults to the synthesised cue player; tests pass a silent one. */
  readonly soundPlayer?: ISoundPlayer;
}

export type ConnectionStatus = 'connecting' | 'synced' | 'failed' | 'disposed';
export type RoomDialog = 'share' | 'export';

type RoomSnapshotDescriptor = ValueDescriptor<
  IRetroSnapshot | undefined,
  IRetroSnapshot | undefined
>;

/**
 * MobX facade over one live retro room. Doc reads and writes go through
 * {@link RetroDocGateway}, presence through {@link PresenceTracker}; the
 * clock, votes and toasts are sub-models. The store keeps the snapshot,
 * the phase and facilitator policy, the open dialog and the lifecycle.
 */
export class RoomStore {
  snapshot: RoomSnapshotDescriptor = EMPTY_VD;
  presentUsers: readonly IParticipant[] = [];
  openDialog: RoomDialog | undefined = undefined;
  identity: IRetroIdentity;

  readonly roomId: RoomId;
  readonly timer: TimerModel;
  readonly voting: VotingModel;
  readonly toast = new ToastModel();

  private readonly providers: IYjsRoomProviders;
  private readonly createIfMissing: IRoomCreateParams | undefined;
  private readonly directory: RoomUserDirectory;
  private readonly lobby: RoomLobbyIndex;
  private readonly gateway: RetroDocGateway;
  private readonly presence: PresenceTracker;
  private readonly disposers: VoidFunction[] = [];
  private isDisposed = false;

  constructor(params: IRoomStoreParams) {
    this.roomId = params.roomId;
    this.identity = params.identity;
    this.providers = params.providers;
    this.createIfMissing = params.createIfMissing;
    this.directory = params.directory;
    this.lobby = params.lobby;
    this.gateway = new RetroDocGateway(params.providers.doc);
    this.timer = new TimerModel({
      readTimer: () => this.currentSnapshot?.meta.timer,
      writeTimer: timer => this.gateway.setTimer(timer),
      isFacilitator: () => this.isFacilitator,
      soundPlayer: params.soundPlayer ?? createSoundPlayer(),
    });
    this.voting = new VotingModel({
      readSnapshot: () => this.currentSnapshot,
      readClientId: () => this.clientId,
      addVote: this.gateway.addVote.bind(this.gateway),
      removeVote: this.gateway.removeVote.bind(this.gateway),
    });
    this.presence = new PresenceTracker({
      awareness: params.providers.awareness,
      directory: params.directory,
      onPresentUsersChange: users => {
        this.applyPresentUsers(users);
      },
    });

    makeAutoObservable<
      RoomStore,
      | 'providers'
      | 'createIfMissing'
      | 'directory'
      | 'lobby'
      | 'gateway'
      | 'presence'
      | 'disposers'
      | 'isDisposed'
      | 'joinedRoomSnapshot'
    >(
      this,
      {
        snapshot: observableRef,
        presentUsers: observableRef,
        identity: observableRef,
        timer: false,
        voting: false,
        toast: false,
        presentParticipantIds: computedStruct,
        joinedRoomSnapshot: computedStruct,
        providers: false,
        createIfMissing: false,
        directory: false,
        lobby: false,
        gateway: false,
        presence: false,
        disposers: false,
        isDisposed: false,
      },
      { autoBind: true }
    );

    this.publishPresence();
    this.disposers.push(this.gateway.subscribe(this.refreshSnapshot));
    this.disposers.push(
      reaction(() => this.joinedRoomSnapshot, this.publishJoinedRoom, { fireImmediately: true })
    );

    void this.initialize();
  }

  get currentSnapshot(): IRetroSnapshot | undefined {
    return isSyncedValueDescriptor(this.snapshot) ? this.snapshot.value : undefined;
  }

  get connectionStatus(): ConnectionStatus {
    if (this.isDisposed) {
      return 'disposed';
    }
    if (isSyncedValueDescriptor(this.snapshot)) {
      return 'synced';
    }
    return isFailValueDescriptor(this.snapshot) ? 'failed' : 'connecting';
  }

  get phase(): RetroPhase {
    return this.currentSnapshot?.meta.phase ?? 'brainstorm';
  }

  get isFacilitator(): boolean {
    const facilitatorClientId = this.currentSnapshot?.meta.facilitatorClientId;
    return !isNil(facilitatorClientId) && facilitatorClientId === this.clientId;
  }

  /** Structurally compared, so heartbeats republishing the same roster are absorbed. */
  get presentParticipantIds(): readonly ClientId[] {
    return this.presentUsers.map(user => user.clientId);
  }

  /**
   * Replaces the identity after the user edited their profile: republishes
   * awareness and, for the facilitator, mirrors the new name into the doc.
   */
  updateIdentity(identity: IRetroIdentity): void {
    this.identity = identity;
    this.publishPresence();
    if (this.isFacilitator && this.currentSnapshot?.meta.facilitatorName !== identity.name) {
      this.gateway.setFacilitatorName(identity.name);
    }
  }

  showDialog(dialog: RoomDialog): void {
    this.openDialog = dialog;
  }

  closeDialog(): void {
    this.openDialog = undefined;
  }

  addCard(columnId: ColumnId, text: string): void {
    this.gateway.addCard({ columnId, authorClientId: this.clientId, text });
  }

  deleteCard(cardId: CardId): void {
    this.gateway.deleteCard(cardId);
  }

  editCard(cardId: CardId, text: string): void {
    this.gateway.editCard({ cardId, authorClientId: this.clientId, text });
  }

  moveCardToColumn(cardId: CardId, targetColumnId: ColumnId, targetIndex: number): void {
    this.gateway.moveCardToColumn({ cardId, targetColumnId, targetIndex });
  }

  moveCardToPosition(
    cardId: CardId,
    targetColumnId: ColumnId,
    targetIndex: number,
    targetGroupId: GroupId | undefined
  ): void {
    this.gateway.moveCardToPosition({ cardId, targetColumnId, targetIndex, targetGroupId });
  }

  groupCards(draggedId: CardId, targetId: CardId): void {
    this.gateway.groupCards(draggedId, targetId);
  }

  setTypingIn(columnId: ColumnId | undefined): void {
    this.presence.publishTyping(columnId);
  }

  setPhase(phase: RetroPhase): void {
    if (this.isFacilitator) {
      this.gateway.setPhase(phase);
    }
  }

  advancePhase(): void {
    this.stepPhase(1);
  }

  rewindPhase(): void {
    this.stepPhase(-1);
  }

  transferFacilitator(clientId: ClientId): void {
    if (!this.isFacilitator) {
      return;
    }
    const targetUser = this.presentUsers.find(user => user.clientId === clientId);
    this.gateway.setFacilitator(clientId, targetUser?.name ?? '');
  }

  /** Anyone may take over while the current facilitator is offline. */
  claimFacilitator(): void {
    const currentClientId = this.currentSnapshot?.meta.facilitatorClientId;
    const isCurrentOnline =
      !isNil(currentClientId) && this.presentUsers.some(user => user.clientId === currentClientId);
    if (!isCurrentOnline) {
      this.gateway.setFacilitator(this.clientId, this.identity.name);
    }
  }

  addActionItem(text: string, sourceGroupId?: GroupId): void {
    this.gateway.addActionItem(text, sourceGroupId);
  }

  deleteActionItem(id: ActionItemId): void {
    this.gateway.deleteActionItem(id);
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.disposers.forEach(dispose => dispose());
    this.disposers.length = 0;
    this.presence.dispose();
    this.toast.dispose();
    this.timer.dispose();
    this.providers.destroy();
  }

  private get clientId(): ClientId {
    return this.identity.clientId as ClientId;
  }

  /** What the lobby's recent-rooms index records; structurally compared so only real changes persist. */
  private get joinedRoomSnapshot(): IJoinedRoomSnapshot | undefined {
    const meta = this.currentSnapshot?.meta;
    if (isNil(meta)) {
      return undefined;
    }
    return {
      roomId: this.roomId,
      name: meta.name,
      template: meta.template,
      createdAt: meta.createdAt,
      facilitatorClientId: meta.facilitatorClientId,
      facilitatorName: meta.facilitatorName,
      participantCount: this.presentUsers.length,
      phase: meta.phase,
      presentParticipantIds: this.presentParticipantIds,
    };
  }

  private stepPhase(direction: 1 | -1): void {
    const nextPhase = PHASE_ORDER[PHASE_ORDER.indexOf(this.phase) + direction];
    if (!isNil(nextPhase)) {
      this.setPhase(nextPhase);
    }
  }

  private publishJoinedRoom(joined: IJoinedRoomSnapshot | undefined): void {
    if (!isNil(joined)) {
      void this.lobby.upsertJoinedRoom(joined);
    }
  }

  private publishPresence(): void {
    this.presence.publishIdentity({
      clientId: this.clientId,
      name: this.identity.name,
      pictureUrl: this.identity.pictureUrl,
    });
  }

  private applyPresentUsers(users: readonly IParticipant[]): void {
    this.presentUsers = users;
  }

  /** Every committed doc transaction, local or remote, refreshes the synced snapshot. */
  private refreshSnapshot(): void {
    if (isSyncedValueDescriptor(this.snapshot)) {
      this.snapshot = createSyncedValueDescriptor(this.gateway.buildSnapshot());
    }
  }

  private async initialize(): Promise<void> {
    try {
      await this.providers.whenSynced();
      if (this.isDisposed) {
        return;
      }
      if (!isNil(this.createIfMissing)) {
        this.gateway.initializeIfMissing({
          name: this.createIfMissing.name,
          template: this.createIfMissing.template,
          facilitatorClientId: this.clientId,
          facilitatorName: this.identity.name,
          votesPerParticipant: this.createIfMissing.votesPerParticipant,
        });
      }

      const snapshot = this.gateway.buildSnapshot();
      // A room whose facilitator is offline still shows their name: seed the
      // directory from the doc until an awareness update overwrites it.
      const facilitatorClientId = snapshot?.meta.facilitatorClientId;
      if (!isNil(snapshot) && !isNil(facilitatorClientId)) {
        void this.directory.seedIfMissing({
          clientId: facilitatorClientId,
          name: snapshot.meta.facilitatorName,
        });
      }
      runInAction(() => {
        this.snapshot = createSyncedValueDescriptor(snapshot);
      });
    } catch (error) {
      const fail = convertErrorToFail(error instanceof Error ? error : new Error(String(error)));
      runInAction(() => {
        this.snapshot = createUnsyncedValueDescriptor<IRetroSnapshot | undefined>(undefined, fail);
      });
    }
  }
}
