import { assertNever } from '@frozik/utils/assert/assertNever';
import { nowEpochMs } from '@frozik/utils/date/now';
import type { Milliseconds } from '@frozik/utils/date/types';
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

import {
  MAX_TIMER_DURATION_MS,
  MIN_TIMER_DURATION_MS,
  PHASE_ORDER,
  TOAST_AUTOCLEAR_MS,
} from '../domain/constants';
import {
  computeRemainingMs,
  ETimerStatus,
  extendTimer,
  getTimerStatus,
  isTimerInWarningZone,
  pauseTimer as pauseTimerState,
  resetTimer as resetTimerState,
  startTimer as startTimerState,
} from '../domain/timer';
import type {
  ActionItemId,
  CardId,
  ClientId,
  ColumnId,
  GroupId,
  IParticipant,
  IRetroSnapshot,
  ITemplateConfig,
  RoomId,
} from '../domain/types';
import { ERetroPhase } from '../domain/types';
import { canPlaceVote, canRetractVote, countVotesUsedByClient } from '../domain/voting';
import type { IRetroIdentity } from '../infrastructure/identity-repo';
import { RetroDocGateway } from '../infrastructure/RetroDocGateway';
import { createSoundPlayer } from '../infrastructure/sound';
import type { IYjsRoomProviders } from '../infrastructure/yjs-providers';
import { PresenceTracker } from './PresenceTracker';
import type { IJoinedRoomSnapshot, RetroLobbyStore } from './RetroLobbyStore';
import { TimerCueController } from './TimerCueController';
import type { UserDirectoryStore } from './UserDirectoryStore';

/**
 * Parameters required to create a fresh room — the doc is initialized on
 * first sync. `null` on the store means "open an existing room".
 */
export interface IRoomCreateParams {
  readonly name: string;
  readonly template: ITemplateConfig;
  readonly votesPerParticipant: number;
}

export interface IRoomStoreParams {
  readonly roomId: RoomId;
  readonly identity: IRetroIdentity;
  readonly providers: IYjsRoomProviders;
  readonly createIfMissing: IRoomCreateParams | null;
  readonly directory: UserDirectoryStore;
  readonly lobby: RetroLobbyStore;
}

export type TimerSeverity = 'idle' | 'running' | 'warning' | 'expired';

export type ConnectionStatus = 'connecting' | 'synced' | 'failed' | 'disposed';

export interface IToast {
  readonly id: string;
  readonly message: string;
}

/**
 * MobX facade over a single live retro room. All Y.Doc reads/writes go
 * through {@link RetroDocGateway}, awareness through {@link PresenceTracker}
 * and timer audio through {@link TimerCueController} — the store itself only
 * owns observable UI state, phase/facilitator policy and lifecycle.
 */
export class RoomStore {
  snapshot: ValueDescriptor<IRetroSnapshot | null, IRetroSnapshot | null> = EMPTY_VD;
  currentSnapshot: IRetroSnapshot | null = null;
  timerTickNow: number = nowEpochMs();

  presentUsers: readonly IParticipant[] = [];
  isShareDialogOpen: boolean = false;
  isExportDialogOpen: boolean = false;
  isCreateDialogOpen: boolean = false;
  lastToast: IToast | null = null;

  identity: IRetroIdentity;
  readonly roomId: RoomId;

  private readonly providers: IYjsRoomProviders;
  private readonly createIfMissing: IRoomCreateParams | null;
  private readonly directory: UserDirectoryStore;
  private readonly lobby: RetroLobbyStore;
  private readonly gateway: RetroDocGateway;
  private readonly presence: PresenceTracker;
  private readonly timerCues: TimerCueController;
  private readonly disposers: (() => void)[] = [];
  private toastTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isDisposed = false;

  constructor(params: IRoomStoreParams) {
    this.roomId = params.roomId;
    this.identity = params.identity;
    this.providers = params.providers;
    this.createIfMissing = params.createIfMissing;
    this.directory = params.directory;
    this.lobby = params.lobby;
    this.gateway = new RetroDocGateway(params.providers.doc);
    this.timerCues = new TimerCueController(createSoundPlayer(), () => {
      this.handleTimerExpired();
    });
    this.presence = new PresenceTracker({
      awareness: params.providers.webrtc.awareness,
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
      | 'timerCues'
      | 'disposers'
      | 'toastTimeoutId'
      | 'isDisposed'
      | 'joinedRoomSnapshot'
    >(
      this,
      {
        snapshot: observableRef,
        currentSnapshot: observableRef,
        timerTickNow: observableRef,
        presentUsers: observableRef,
        lastToast: observableRef,
        identity: observableRef,
        presentParticipantIds: computedStruct,
        joinedRoomSnapshot: computedStruct,
        // Deliberately NOT an action: the UI calls it while rendering, so it
        // must stay tracked — actions run untracked and would freeze the
        // vote button's disabled state.
        canAddVoteTo: false,
        providers: false,
        createIfMissing: false,
        directory: false,
        lobby: false,
        gateway: false,
        presence: false,
        timerCues: false,
        disposers: false,
        toastTimeoutId: false,
        isDisposed: false,
      },
      { autoBind: true }
    );

    this.publishPresence();
    this.disposers.push(
      this.gateway.subscribe(() => {
        this.updateSnapshotFromDoc();
      })
    );
    this.disposers.push(
      reaction(
        () => this.joinedRoomSnapshot,
        joined => {
          this.publishJoinedRoom(joined);
        },
        { fireImmediately: true }
      )
    );

    void this.initialize();
  }

  /**
   * Replace the cached identity (used after the user edits their name or
   * color in the lobby). Republishes awareness and, if this client is the
   * facilitator, mirrors the new display name into `meta.facilitatorName`
   * so other peers and the lobby index see the rename.
   */
  updateIdentity(identity: IRetroIdentity): void {
    this.identity = identity;
    this.publishPresence();

    if (!this.isFacilitator) {
      return;
    }
    const storedName = this.currentSnapshot?.meta.facilitatorName ?? '';
    if (storedName === identity.name) {
      return;
    }
    this.gateway.setFacilitatorName(identity.name);
  }

  tickTimer(): void {
    this.timerTickNow = nowEpochMs();
    this.timerCues.handleTick(this.currentSnapshot?.meta.timer, this.timerTickNow as Milliseconds);
  }

  get timerSeverity(): TimerSeverity {
    const timer = this.currentSnapshot?.meta.timer;
    if (isNil(timer)) {
      return 'idle';
    }
    const now = this.timerTickNow as Milliseconds;
    const status = getTimerStatus(timer, now);
    switch (status) {
      case ETimerStatus.Idle:
        return 'idle';
      case ETimerStatus.Paused:
        // Paused with 0 remaining is the auto-pause-at-expiry state — keep
        // it visually "expired" (red clock) even though the timer isn't
        // running. Any other paused value stays neutral.
        return computeRemainingMs(timer, now) <= 0 ? 'expired' : 'idle';
      case ETimerStatus.Expired:
        return 'expired';
      case ETimerStatus.Running:
        return isTimerInWarningZone(timer, now) ? 'warning' : 'running';
      default:
        return assertNever(status);
    }
  }

  get remainingTimerMs(): Milliseconds {
    const timer = this.currentSnapshot?.meta.timer;
    if (isNil(timer)) {
      return 0 as Milliseconds;
    }
    return computeRemainingMs(timer, this.timerTickNow as Milliseconds);
  }

  get phase(): ERetroPhase {
    return this.currentSnapshot?.meta.phase ?? ERetroPhase.Brainstorm;
  }

  get myVotesUsed(): number {
    const votes = this.currentSnapshot?.votes;
    if (isNil(votes)) {
      return 0;
    }
    return countVotesUsedByClient(votes, this.clientId);
  }

  /**
   * Whether the local client may place one more vote on `targetId` —
   * consults the domain rules (Vote phase, total allowance, per-target
   * limit). Drives the disabled state of the "+" vote button.
   */
  canAddVoteTo(targetId: CardId | GroupId): boolean {
    const snapshot = this.currentSnapshot;
    if (isNil(snapshot)) {
      return false;
    }
    return canPlaceVote({
      phase: snapshot.meta.phase,
      votes: snapshot.votes,
      targetId,
      clientId: this.clientId,
      votesPerParticipant: snapshot.meta.votesPerParticipant,
    }).allowed;
  }

  get isFacilitator(): boolean {
    const facilitatorClientId = this.currentSnapshot?.meta.facilitatorClientId ?? null;
    return facilitatorClientId !== null && facilitatorClientId === this.identity.clientId;
  }

  unlockChime(): void {
    this.timerCues.unlock();
  }

  get connectionStatus(): ConnectionStatus {
    if (this.isDisposed) {
      return 'disposed';
    }
    if (isSyncedValueDescriptor(this.snapshot)) {
      return 'synced';
    }
    if (isFailValueDescriptor(this.snapshot)) {
      return 'failed';
    }
    return 'connecting';
  }

  /**
   * Stable list of the clientIds currently visible through awareness.
   * Structurally compared so it only "changes" when room membership does —
   * heartbeats republishing the same roster are absorbed.
   */
  get presentParticipantIds(): readonly ClientId[] {
    return this.presentUsers.map(user => user.clientId);
  }

  openShareDialog(): void {
    this.isShareDialogOpen = true;
  }

  closeShareDialog(): void {
    this.isShareDialogOpen = false;
  }

  openExportDialog(): void {
    this.isExportDialogOpen = true;
  }

  closeExportDialog(): void {
    this.isExportDialogOpen = false;
  }

  openCreateDialog(): void {
    this.isCreateDialogOpen = true;
  }

  closeCreateDialog(): void {
    this.isCreateDialogOpen = false;
  }

  showToast(message: string): void {
    if (this.toastTimeoutId !== null) {
      clearTimeout(this.toastTimeoutId);
    }
    this.lastToast = { id: crypto.randomUUID(), message };
    this.toastTimeoutId = setTimeout(() => {
      runInAction(() => this.clearToast());
    }, TOAST_AUTOCLEAR_MS);
  }

  clearToast(): void {
    this.lastToast = null;
    this.toastTimeoutId = null;
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
    targetGroupId: GroupId | null
  ): void {
    this.gateway.moveCardToPosition({ cardId, targetColumnId, targetIndex, targetGroupId });
  }

  groupCards(draggedId: CardId, targetId: CardId): void {
    this.gateway.groupCards(draggedId, targetId);
  }

  setTypingIn(columnId: ColumnId | null): void {
    this.presence.publishTyping(columnId);
  }

  setPhase(phase: ERetroPhase): void {
    if (!this.isFacilitator) {
      return;
    }
    this.gateway.setPhase(phase);
  }

  advancePhase(): void {
    if (!this.isFacilitator) {
      return;
    }
    const index = PHASE_ORDER.indexOf(this.phase);
    if (index < 0 || index === PHASE_ORDER.length - 1) {
      return;
    }
    this.setPhase(PHASE_ORDER[index + 1] as ERetroPhase);
  }

  rewindPhase(): void {
    if (!this.isFacilitator) {
      return;
    }
    const index = PHASE_ORDER.indexOf(this.phase);
    if (index <= 0) {
      return;
    }
    this.setPhase(PHASE_ORDER[index - 1] as ERetroPhase);
  }

  startTimer(): void {
    if (!this.isFacilitator) {
      return;
    }
    const timer = this.currentSnapshot?.meta.timer;
    if (isNil(timer)) {
      return;
    }
    this.gateway.setTimer(startTimerState(timer, nowEpochMs() as Milliseconds));
  }

  pauseTimer(): void {
    if (!this.isFacilitator) {
      return;
    }
    const timer = this.currentSnapshot?.meta.timer;
    if (isNil(timer)) {
      return;
    }
    this.gateway.setTimer(pauseTimerState(timer, nowEpochMs() as Milliseconds));
  }

  addTimerMilliseconds(extraMs: Milliseconds): void {
    if (!this.isFacilitator) {
      return;
    }
    const timer = this.currentSnapshot?.meta.timer;
    if (isNil(timer)) {
      return;
    }
    // Clamp the effective remaining time to [MIN, MAX] — e.g. on 55s the
    // user can click -30s and land exactly on 30s instead of being fully
    // rejected. The actual delta applied is the clamped one.
    const currentRemainingMs = computeRemainingMs(timer, nowEpochMs() as Milliseconds);
    const rawNextRemaining = currentRemainingMs + extraMs;
    const clampedNextRemaining = Math.min(
      Math.max(rawNextRemaining, MIN_TIMER_DURATION_MS),
      MAX_TIMER_DURATION_MS
    );
    const effectiveDelta = (clampedNextRemaining - currentRemainingMs) as Milliseconds;
    if (effectiveDelta === 0) {
      return;
    }
    this.gateway.setTimer(extendTimer(timer, effectiveDelta));
  }

  resetTimer(durationMs: Milliseconds): void {
    if (!this.isFacilitator) {
      return;
    }
    this.gateway.setTimer(resetTimerState(durationMs));
  }

  transferFacilitator(clientId: ClientId): void {
    if (!this.isFacilitator) {
      return;
    }
    const targetUser = this.presentUsers.find(user => user.clientId === clientId);
    this.gateway.setFacilitator(clientId, targetUser?.name ?? '');
  }

  claimFacilitator(): void {
    const currentClientId = this.currentSnapshot?.meta.facilitatorClientId ?? null;
    const isCurrentOnline =
      currentClientId !== null && this.presentUsers.some(user => user.clientId === currentClientId);
    if (isCurrentOnline) {
      return;
    }
    this.gateway.setFacilitator(this.clientId, this.identity.name);
  }

  addVote(targetId: CardId | GroupId): void {
    if (!this.canAddVoteTo(targetId)) {
      return;
    }
    this.gateway.addVote(targetId, this.clientId);
  }

  removeVote(targetId: CardId | GroupId): void {
    const snapshot = this.currentSnapshot;
    if (isNil(snapshot)) {
      return;
    }
    if (!canRetractVote(snapshot.meta.phase, snapshot.votes, targetId, this.clientId)) {
      return;
    }
    this.gateway.removeVote(targetId, this.clientId);
  }

  addActionItem(text: string, sourceGroupId: GroupId | null = null): void {
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
    if (this.toastTimeoutId !== null) {
      clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }
    this.timerCues.dispose();
    this.providers.destroy();
  }

  private get clientId(): ClientId {
    return this.identity.clientId as ClientId;
  }

  /**
   * Everything the lobby's recent-rooms index records about this room.
   * Structurally compared, so the reaction that persists it fires on real
   * changes only — not on every Yjs transaction or awareness heartbeat.
   */
  private get joinedRoomSnapshot(): IJoinedRoomSnapshot | null {
    const meta = this.currentSnapshot?.meta;
    if (isNil(meta)) {
      return null;
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

  private publishJoinedRoom(joined: IJoinedRoomSnapshot | null): void {
    if (isNil(joined)) {
      return;
    }
    void this.lobby.upsertJoinedRoom(joined);
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

  private updateSnapshotFromDoc(): void {
    this.currentSnapshot = this.gateway.buildSnapshot();
  }

  /**
   * Only the facilitator writes the pause — the Yjs update propagates to
   * everyone so all peers stop the clock at 00:00 instead of letting it keep
   * ticking into negative territory.
   */
  private handleTimerExpired(): void {
    if (!this.isFacilitator) {
      return;
    }
    this.pauseTimer();
  }

  private async initialize(): Promise<void> {
    try {
      await this.providers.whenSynced();

      if (this.isDisposed) {
        return;
      }

      const createParams = this.createIfMissing;
      if (!isNil(createParams)) {
        this.gateway.initializeIfMissing({
          name: createParams.name,
          template: createParams.template,
          facilitatorClientId: this.clientId,
          facilitatorName: this.identity.name,
          votesPerParticipant: createParams.votesPerParticipant,
        });
      }

      const snapshot = this.gateway.buildSnapshot();

      // Bootstrap the directory with the facilitator profile extracted
      // from meta — covers the case where we open a room whose facilitator
      // is offline. Any later awareness update will overwrite this entry.
      if (!isNil(snapshot) && !isNil(snapshot.meta.facilitatorClientId)) {
        void this.directory.seedIfMissing({
          clientId: snapshot.meta.facilitatorClientId,
          name: snapshot.meta.facilitatorName,
        });
      }

      runInAction(() => {
        this.currentSnapshot = snapshot;
        this.snapshot = createSyncedValueDescriptor<IRetroSnapshot | null>(snapshot);
      });
    } catch (error) {
      const fail = convertErrorToFail(error instanceof Error ? error : new Error(String(error)));

      runInAction(() => {
        this.snapshot = createUnsyncedValueDescriptor<IRetroSnapshot | null>(null, fail);
      });
    }
  }
}
