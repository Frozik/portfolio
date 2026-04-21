import type { ISO, Milliseconds, ValueDescriptor } from '@frozik/utils';
import {
  convertErrorToFail,
  createSyncedValueDescriptor,
  createUnsyncedValueDescriptor,
  EMPTY_VD,
  isFailValueDescriptor,
  isSyncedValueDescriptor,
} from '@frozik/utils';
import { Temporal } from '@js-temporal/polyfill';
import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import * as Y from 'yjs';
import { TIMER_WARNING_THRESHOLD_MS, TOAST_AUTOCLEAR_MS } from '../domain/constants';
import { createRetroSnapshot } from '../domain/retro-snapshot';
import { getTemplateById } from '../domain/templates';
import {
  computeRemainingMs,
  extendTimer,
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
  IActionItem,
  IColumnConfig,
  IParticipant,
  IRetroCard,
  IRetroGroup,
  IRetroMeta,
  IRetroSnapshot,
  ITemplateConfig,
  RoomId,
  VotesByTarget,
} from '../domain/types';
import { ERetroPhase } from '../domain/types';
import type { IRetroDocHandles } from '../domain/yjs-schema';
import {
  getRetroHandles,
  initRetroDoc,
  YJS_META_FIELD_CREATED_AT,
  YJS_META_FIELD_FACILITATOR_CLIENT_ID,
  YJS_META_FIELD_FACILITATOR_NAME,
  YJS_META_FIELD_NAME,
  YJS_META_FIELD_PHASE,
  YJS_META_FIELD_TEMPLATE,
  YJS_META_FIELD_TIMER,
  YJS_META_FIELD_VOTES_PER_PARTICIPANT,
} from '../domain/yjs-schema';
import type { IRetroIdentity } from '../infrastructure/identity-repo';
import type { ISoundPlayer } from '../infrastructure/sound';
import { createSoundPlayer, ERetroSoundCue } from '../infrastructure/sound';
import type { IYjsRoomProviders } from '../infrastructure/yjs-providers';
import type { UserDirectoryStore } from './UserDirectoryStore';

/**
 * Parameters required to either open an existing room (skipped init) or
 * create a fresh one (initialized on first sync).
 */
export interface IRoomStoreInit {
  readonly roomId: RoomId;
  readonly identity: IRetroIdentity;
  readonly createIfMissing: {
    readonly name: string;
    readonly template: ITemplateConfig;
    readonly votesPerParticipant: number;
  } | null;
}

export type TimerSeverity = 'idle' | 'running' | 'warning' | 'expired';

export type ConnectionStatus = 'connecting' | 'synced' | 'failed' | 'disposed';

export interface IToast {
  readonly id: string;
  readonly message: string;
}

const PRESENCE_HEARTBEAT_INTERVAL_MS = 10_000;

export class RoomStore {
  snapshot: ValueDescriptor<IRetroSnapshot | null, IRetroSnapshot | null> = EMPTY_VD;
  currentSnapshot: IRetroSnapshot | null = null;
  timerTickNow: number = Date.now();

  presentUsers: readonly IParticipant[] = [];
  isShareDialogOpen: boolean = false;
  isExportDialogOpen: boolean = false;
  isCreateDialogOpen: boolean = false;
  lastToast: IToast | null = null;

  private readonly handles: IRetroDocHandles;
  private readonly onAfterTransaction: () => void;
  private readonly onAwarenessChange: () => void;
  private readonly soundPlayer: ISoundPlayer;
  private toastTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private presenceHeartbeatId: ReturnType<typeof setInterval> | null = null;
  private lastTimerSeverity: TimerSeverity = 'idle';
  private isDisposed = false;

  identity: IRetroIdentity;

  constructor(
    readonly roomId: RoomId,
    initialIdentity: IRetroIdentity,
    private readonly providers: IYjsRoomProviders,
    private readonly createIfMissing: IRoomStoreInit['createIfMissing'],
    private readonly directory: UserDirectoryStore
  ) {
    this.identity = initialIdentity;
    this.handles = getRetroHandles(providers.doc);
    this.soundPlayer = createSoundPlayer();

    makeObservable(
      this,
      {
        snapshot: observable.ref,
        currentSnapshot: observable.ref,
        timerTickNow: observable.ref,
        presentUsers: observable.ref,
        isShareDialogOpen: observable,
        isExportDialogOpen: observable,
        isCreateDialogOpen: observable,
        lastToast: observable.ref,
        identity: observable.ref,
        timerSeverity: computed,
        remainingTimerMs: computed,
        phase: computed,
        myVotesUsed: computed,
        canVoteMore: computed,
        isFacilitator: computed,
        connectionStatus: computed,
        updateSnapshotFromDoc: action,
        tickTimer: action,
        updatePresentUsers: action,
        openShareDialog: action.bound,
        closeShareDialog: action.bound,
        openExportDialog: action.bound,
        closeExportDialog: action.bound,
        openCreateDialog: action.bound,
        closeCreateDialog: action.bound,
        showToast: action,
        clearToast: action,
        addCard: action,
        deleteCard: action,
        editCard: action,
        moveCardToColumn: action,
        groupCards: action,
        setTypingIn: action,
        setPhase: action,
        advancePhase: action,
        rewindPhase: action,
        startTimer: action,
        pauseTimer: action,
        addTimerMilliseconds: action,
        resetTimer: action,
        transferFacilitator: action,
        claimFacilitator: action,
        addVote: action,
        removeVote: action,
        addActionItem: action,
        deleteActionItem: action,
        updateIdentity: action,
      },
      { autoBind: true }
    );

    this.onAfterTransaction = (): void => this.updateSnapshotFromDoc();
    providers.doc.on('afterTransaction', this.onAfterTransaction);

    this.onAwarenessChange = (): void => this.updatePresentUsers();
    providers.webrtc.awareness.on('change', this.onAwarenessChange);

    this.publishLocalPresence();

    // Keep awareness alive: republish every 10s so peers never drop us as
    // stale (awareness default timeout is ~30s on most y-webrtc setups).
    this.presenceHeartbeatId = setInterval(() => {
      if (!this.isDisposed) {
        this.publishLocalPresence();
      }
    }, PRESENCE_HEARTBEAT_INTERVAL_MS);

    void this.initialize();
  }

  publishLocalPresence(): void {
    const participant: IParticipant = {
      clientId: this.identity.clientId as ClientId,
      name: this.identity.name,
      color: this.identity.color,
      typingInColumnId: null,
    };
    this.providers.webrtc.awareness.setLocalStateField('user', participant);
  }

  /**
   * Replace the cached identity (used after the user edits their name or
   * color in the lobby). Republishes awareness and, if this client is the
   * facilitator, mirrors the new display name into `meta.facilitatorName`
   * so other peers and the lobby index see the rename.
   */
  updateIdentity(identity: IRetroIdentity): void {
    this.identity = identity;
    this.publishLocalPresence();

    if (!this.isFacilitator) {
      return;
    }
    const storedName = this.currentSnapshot?.meta.facilitatorName ?? '';
    if (storedName === identity.name) {
      return;
    }
    this.providers.doc.transact(() => {
      this.handles.meta.set(YJS_META_FIELD_FACILITATOR_NAME, identity.name);
    });
  }

  updateSnapshotFromDoc(): void {
    this.currentSnapshot = this.buildSnapshot();
  }

  tickTimer(): void {
    this.timerTickNow = Date.now();
    const severity = this.timerSeverity;
    if (severity !== this.lastTimerSeverity) {
      if (severity === 'expired' && this.lastTimerSeverity !== 'expired') {
        this.soundPlayer.play(ERetroSoundCue.TimerExpired);
      } else if (severity === 'warning' && this.lastTimerSeverity === 'running') {
        this.soundPlayer.play(ERetroSoundCue.TimerWarning);
      }
      this.lastTimerSeverity = severity;
    }
  }

  get timerSeverity(): TimerSeverity {
    const meta = this.currentSnapshot?.meta;
    if (meta === undefined) {
      return 'idle';
    }
    const { timer } = meta;
    if (timer.startedAt === null) {
      return 'idle';
    }
    const remaining = computeRemainingMs(timer, this.timerTickNow as Milliseconds);
    if (remaining <= 0) {
      return 'expired';
    }
    if (remaining <= TIMER_WARNING_THRESHOLD_MS) {
      return 'warning';
    }
    return 'running';
  }

  get remainingTimerMs(): Milliseconds {
    const timer = this.currentSnapshot?.meta.timer;
    if (timer === undefined) {
      return 0 as Milliseconds;
    }
    return computeRemainingMs(timer, this.timerTickNow as Milliseconds);
  }

  get phase(): ERetroPhase {
    return this.currentSnapshot?.meta.phase ?? ERetroPhase.Brainstorm;
  }

  get myVotesUsed(): number {
    const votes = this.currentSnapshot?.votes;
    if (votes === undefined) {
      return 0;
    }
    let total = 0;
    votes.forEach(perClient => {
      total += perClient.get(this.identity.clientId as ClientId) ?? 0;
    });
    return total;
  }

  get canVoteMore(): boolean {
    const limit = this.currentSnapshot?.meta.votesPerParticipant ?? 0;
    return this.myVotesUsed < limit;
  }

  get isFacilitator(): boolean {
    const facilitatorClientId = this.currentSnapshot?.meta.facilitatorClientId ?? null;
    return facilitatorClientId !== null && facilitatorClientId === this.identity.clientId;
  }

  playTimerExpiredChime(): void {
    this.soundPlayer.play(ERetroSoundCue.TimerExpired);
  }

  unlockChime(): void {
    this.soundPlayer.unlock();
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

  updatePresentUsers(): void {
    const states = this.providers.webrtc.awareness.getStates();
    const meta = this.providers.webrtc.awareness.meta as Map<number, { lastUpdated: number }>;

    // Awareness is keyed by per-session Yjs client ids, but our user
    // identity has its own stable `clientId` (from localStorage). When the
    // same person reconnects they appear twice until the stale awareness
    // entry times out — dedupe here by identity.clientId, keeping the
    // entry with the freshest `lastUpdated` meta.
    const deduped = new Map<number, { user: IParticipant; lastUpdated: number }>();
    states.forEach((state, yjsClientId) => {
      const user = (state as { user?: IParticipant }).user;
      if (user === undefined) {
        return;
      }
      const lastUpdated = meta.get(yjsClientId)?.lastUpdated ?? 0;
      const existing = deduped.get(user.clientId);
      if (existing === undefined || lastUpdated >= existing.lastUpdated) {
        deduped.set(user.clientId, { user, lastUpdated });
      }
    });

    const users = Array.from(deduped.values()).map(entry => entry.user);
    users.forEach(user => {
      void this.directory.upsert({
        clientId: user.clientId,
        name: user.name,
        color: user.color,
      });
    });
    this.presentUsers = users;
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
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return;
    }
    const cards = this.handles.cards.get(columnId);
    if (cards === undefined) {
      return;
    }
    const card = {
      id: crypto.randomUUID() as CardId,
      authorClientId: this.identity.clientId as ClientId,
      columnId,
      text: trimmed,
      createdAt: Temporal.Now.instant().toString() as ISO,
      groupId: null,
    };
    this.providers.doc.transact(() => {
      cards.push([card]);
    });
  }

  deleteCard(cardId: CardId): void {
    this.providers.doc.transact(() => {
      const location = this.findCardLocation(cardId);
      if (location === null) {
        return;
      }
      if (location.record.groupId !== null) {
        this.removeCardFromGroup(cardId, location.record.groupId as GroupId);
      }
      const list = this.handles.cards.get(location.columnId);
      if (list === undefined) {
        return;
      }
      list.delete(location.index, 1);
    });
  }

  editCard(cardId: CardId, text: string): void {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return;
    }
    this.providers.doc.transact(() => {
      this.handles.cards.forEach(list => {
        for (let index = 0; index < list.length; index++) {
          const record = list.get(index);
          if (record.id !== cardId) {
            continue;
          }
          if (record.authorClientId !== (this.identity.clientId as ClientId)) {
            return;
          }
          list.delete(index, 1);
          list.insert(index, [{ ...record, text: trimmed }]);
          return;
        }
      });
    });
  }

  moveCardToColumn(cardId: CardId, targetColumnId: ColumnId, targetIndex: number): void {
    this.providers.doc.transact(() => {
      const location = this.findCardLocation(cardId);
      if (location === null) {
        return;
      }
      if (location.record.groupId !== null) {
        this.removeCardFromGroup(cardId, location.record.groupId as GroupId);
      }
      const sourceList = this.handles.cards.get(location.columnId);
      const targetList = this.handles.cards.get(targetColumnId);
      if (sourceList === undefined || targetList === undefined) {
        return;
      }
      sourceList.delete(location.index, 1);
      const clampedIndex = Math.max(0, Math.min(targetIndex, targetList.length));
      targetList.insert(clampedIndex, [
        { ...location.record, columnId: targetColumnId, groupId: null },
      ]);
    });
  }

  /**
   * Merge `draggedId` into `targetId`'s group. If the target card has no
   * group yet, a new group is created wrapping both cards; otherwise the
   * dragged card is appended to the existing group. The dragged card is
   * moved into the target's column if it was living elsewhere. If the
   * dragged card was in a different group, that group is cleaned up
   * (dissolved when it drops below 2 cards).
   */
  groupCards(draggedId: CardId, targetId: CardId): void {
    if (draggedId === targetId) {
      return;
    }
    this.providers.doc.transact(() => {
      const target = this.findCardLocation(targetId);
      const dragged = this.findCardLocation(draggedId);
      if (target === null || dragged === null) {
        return;
      }

      if (dragged.record.groupId !== null && dragged.record.groupId !== target.record.groupId) {
        this.removeCardFromGroup(draggedId, dragged.record.groupId as GroupId);
      }

      const groupId = this.ensureGroupForCard(target) as GroupId;
      const groupMap = this.handles.groups.get(groupId);
      if (groupMap === undefined) {
        return;
      }

      const currentCardIds = this.readGroupCardIds(groupMap);
      if (!currentCardIds.includes(draggedId)) {
        groupMap.set('cardIds', [...currentCardIds, draggedId]);
      }

      const groupColumnId =
        (groupMap.get('columnId') as ColumnId | undefined) ?? target.record.columnId;

      // Re-read dragged location — `removeCardFromGroup` may have mutated
      // the card record (when the previous group dissolved into a singleton
      // it flipped the sibling's groupId, not the dragged card's).
      const draggedAfter = this.findCardLocation(draggedId);
      if (draggedAfter === null) {
        return;
      }

      const sourceList = this.handles.cards.get(draggedAfter.columnId);
      const destList = this.handles.cards.get(groupColumnId);
      if (sourceList === undefined || destList === undefined) {
        return;
      }
      sourceList.delete(draggedAfter.index, 1);
      destList.push([{ ...draggedAfter.record, columnId: groupColumnId, groupId }]);
    });
  }

  private findCardLocation(
    cardId: CardId
  ): { columnId: ColumnId; index: number; record: IRetroCard } | null {
    let result: { columnId: ColumnId; index: number; record: IRetroCard } | null = null;
    this.handles.cards.forEach((list, columnId) => {
      if (result !== null) {
        return;
      }
      for (let index = 0; index < list.length; index++) {
        const record = list.get(index);
        if (record.id === cardId) {
          result = {
            columnId: columnId as ColumnId,
            index,
            record: record as IRetroCard,
          };
          return;
        }
      }
    });
    return result;
  }

  private ensureGroupForCard(location: {
    columnId: ColumnId;
    index: number;
    record: IRetroCard;
  }): string {
    if (location.record.groupId !== null) {
      return location.record.groupId;
    }
    const groupId = crypto.randomUUID();
    const groupMap = new Y.Map<unknown>();
    groupMap.set('id', groupId);
    groupMap.set('columnId', location.record.columnId);
    groupMap.set('title', '');
    groupMap.set('cardIds', [location.record.id]);
    this.handles.groups.set(groupId, groupMap);

    const list = this.handles.cards.get(location.columnId);
    if (list !== undefined) {
      list.delete(location.index, 1);
      list.insert(location.index, [{ ...location.record, groupId: groupId as GroupId }]);
    }
    return groupId;
  }

  private removeCardFromGroup(cardId: CardId, groupId: GroupId): void {
    const groupMap = this.handles.groups.get(groupId);
    if (groupMap === undefined) {
      return;
    }
    const nextCardIds = this.readGroupCardIds(groupMap).filter(id => id !== cardId);

    if (nextCardIds.length >= 2) {
      groupMap.set('cardIds', nextCardIds);
      return;
    }

    // Dissolve group: clear sibling's groupId (if any) and drop the map.
    if (nextCardIds.length === 1) {
      const lastLocation = this.findCardLocation(nextCardIds[0] as CardId);
      if (lastLocation !== null) {
        const list = this.handles.cards.get(lastLocation.columnId);
        if (list !== undefined) {
          list.delete(lastLocation.index, 1);
          list.insert(lastLocation.index, [{ ...lastLocation.record, groupId: null }]);
        }
      }
    }
    this.handles.groups.delete(groupId);
  }

  private readGroupCardIds(groupMap: Y.Map<unknown>): readonly string[] {
    const raw = groupMap.get('cardIds');
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter((value): value is string => typeof value === 'string');
  }

  setTypingIn(columnId: ColumnId | null): void {
    const participant: IParticipant = {
      clientId: this.identity.clientId as ClientId,
      name: this.identity.name,
      color: this.identity.color,
      typingInColumnId: columnId,
    };
    this.providers.webrtc.awareness.setLocalStateField('user', participant);
  }

  setPhase(phase: ERetroPhase): void {
    if (!this.isFacilitator) {
      return;
    }
    this.providers.doc.transact(() => {
      this.handles.meta.set(YJS_META_FIELD_PHASE, phase);
    });
  }

  advancePhase(): void {
    if (!this.isFacilitator) {
      return;
    }
    const order: readonly ERetroPhase[] = [
      ERetroPhase.Brainstorm,
      ERetroPhase.Group,
      ERetroPhase.Vote,
      ERetroPhase.Discuss,
      ERetroPhase.Close,
    ];
    const index = order.indexOf(this.phase);
    if (index < 0 || index === order.length - 1) {
      return;
    }
    this.setPhase(order[index + 1] as ERetroPhase);
  }

  rewindPhase(): void {
    if (!this.isFacilitator) {
      return;
    }
    const order: readonly ERetroPhase[] = [
      ERetroPhase.Brainstorm,
      ERetroPhase.Group,
      ERetroPhase.Vote,
      ERetroPhase.Discuss,
      ERetroPhase.Close,
    ];
    const index = order.indexOf(this.phase);
    if (index <= 0) {
      return;
    }
    this.setPhase(order[index - 1] as ERetroPhase);
  }

  private writeTimer(timer: IRetroMeta['timer']): void {
    this.providers.doc.transact(() => {
      this.handles.meta.set(YJS_META_FIELD_TIMER, timer);
    });
  }

  startTimer(): void {
    if (!this.isFacilitator) {
      return;
    }
    const timer = this.currentSnapshot?.meta.timer;
    if (timer === undefined) {
      return;
    }
    this.writeTimer(startTimerState(timer, Date.now() as Milliseconds));
  }

  pauseTimer(): void {
    if (!this.isFacilitator) {
      return;
    }
    const timer = this.currentSnapshot?.meta.timer;
    if (timer === undefined) {
      return;
    }
    this.writeTimer(pauseTimerState(timer, Date.now() as Milliseconds));
  }

  addTimerMilliseconds(extraMs: Milliseconds): void {
    if (!this.isFacilitator) {
      return;
    }
    const timer = this.currentSnapshot?.meta.timer;
    if (timer === undefined) {
      return;
    }
    this.writeTimer(extendTimer(timer, extraMs));
  }

  resetTimer(durationMs: Milliseconds): void {
    if (!this.isFacilitator) {
      return;
    }
    this.writeTimer(resetTimerState(durationMs));
  }

  transferFacilitator(clientId: ClientId): void {
    if (!this.isFacilitator) {
      return;
    }
    const targetUser = this.presentUsers.find(user => user.clientId === clientId);
    const nextName = targetUser?.name ?? '';
    this.providers.doc.transact(() => {
      this.handles.meta.set(YJS_META_FIELD_FACILITATOR_CLIENT_ID, clientId);
      this.handles.meta.set(YJS_META_FIELD_FACILITATOR_NAME, nextName);
    });
  }

  claimFacilitator(): void {
    const currentClientId = this.currentSnapshot?.meta.facilitatorClientId ?? null;
    const isCurrentOnline =
      currentClientId !== null && this.presentUsers.some(user => user.clientId === currentClientId);
    if (isCurrentOnline) {
      return;
    }
    this.providers.doc.transact(() => {
      this.handles.meta.set(
        YJS_META_FIELD_FACILITATOR_CLIENT_ID,
        this.identity.clientId as ClientId
      );
      this.handles.meta.set(YJS_META_FIELD_FACILITATOR_NAME, this.identity.name);
    });
  }

  addVote(targetId: CardId | GroupId): void {
    if (!this.canVoteMore) {
      return;
    }
    this.providers.doc.transact(() => {
      let perClient = this.handles.votes.get(targetId);
      if (perClient === undefined) {
        perClient = new Y.Map<number>();
        this.handles.votes.set(targetId, perClient);
      }
      const key = String(this.identity.clientId);
      const current = perClient.get(key) ?? 0;
      perClient.set(key, current + 1);
    });
  }

  removeVote(targetId: CardId | GroupId): void {
    this.providers.doc.transact(() => {
      const perClient = this.handles.votes.get(targetId);
      if (perClient === undefined) {
        return;
      }
      const key = String(this.identity.clientId);
      const current = perClient.get(key) ?? 0;
      if (current <= 1) {
        perClient.delete(key);
      } else {
        perClient.set(key, current - 1);
      }
    });
  }

  addActionItem(text: string, sourceGroupId: GroupId | null = null): void {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return;
    }
    this.providers.doc.transact(() => {
      this.handles.actionItems.push([
        {
          id: crypto.randomUUID() as ActionItemId,
          text: trimmed,
          sourceGroupId,
          ownerClientId: null,
          createdAt: Temporal.Now.instant().toString() as ISO,
        },
      ]);
    });
  }

  deleteActionItem(id: ActionItemId): void {
    this.providers.doc.transact(() => {
      for (let index = 0; index < this.handles.actionItems.length; index++) {
        const record = this.handles.actionItems.get(index);
        if (record.id === id) {
          this.handles.actionItems.delete(index, 1);
          return;
        }
      }
    });
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.providers.doc.off('afterTransaction', this.onAfterTransaction);
    this.providers.webrtc.awareness.off('change', this.onAwarenessChange);
    // Explicitly clear awareness before disconnecting so other peers see
    // us leave instantly instead of waiting for the default 30s timeout.
    // Without this, a quick rejoin produces a duplicate user entry on
    // peers until the stale awareness state expires.
    try {
      this.providers.webrtc.awareness.setLocalState(null);
    } catch {
      // awareness may already be torn down — ignore.
    }
    if (this.toastTimeoutId !== null) {
      clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }
    if (this.presenceHeartbeatId !== null) {
      clearInterval(this.presenceHeartbeatId);
      this.presenceHeartbeatId = null;
    }
    this.soundPlayer.dispose();
    this.providers.destroy();
  }

  private async initialize(): Promise<void> {
    try {
      await this.providers.whenSynced();

      if (this.isDisposed) {
        return;
      }

      if (this.createIfMissing !== null) {
        initRetroDoc(this.handles, {
          name: this.createIfMissing.name,
          template: this.createIfMissing.template,
          facilitatorClientId: this.identity.clientId as ClientId,
          facilitatorName: this.identity.name,
          votesPerParticipant: this.createIfMissing.votesPerParticipant,
        });
      }

      const snapshot = this.buildSnapshot();

      // Bootstrap the directory with the facilitator profile extracted
      // from meta — covers the case where we open a room whose facilitator
      // is offline. Any later awareness update will overwrite this entry.
      if (snapshot !== null && snapshot.meta.facilitatorClientId !== null) {
        void this.directory.seedIfMissing({
          clientId: snapshot.meta.facilitatorClientId,
          name: snapshot.meta.facilitatorName,
          color: '#64748b',
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

  private buildSnapshot(): IRetroSnapshot | null {
    if (!this.handles.meta.has(YJS_META_FIELD_CREATED_AT)) {
      return null;
    }

    const meta = this.readMeta();

    if (meta === null) {
      return null;
    }

    const columns = this.handles.columns.toArray() as readonly IColumnConfig[];
    const cards = this.readCards(columns);
    const groups = this.readGroups();
    const actionItems = this.readActionItems();
    const votes = this.readVotes();

    return createRetroSnapshot({
      meta,
      columns,
      cards,
      groups,
      actionItems,
      votes,
    });
  }

  private readMeta(): IRetroMeta | null {
    const name = this.handles.meta.get(YJS_META_FIELD_NAME);
    const createdAt = this.handles.meta.get(YJS_META_FIELD_CREATED_AT);
    const templateId = this.handles.meta.get(YJS_META_FIELD_TEMPLATE);
    const phase = this.handles.meta.get(YJS_META_FIELD_PHASE);
    const facilitatorClientId = this.handles.meta.get(YJS_META_FIELD_FACILITATOR_CLIENT_ID);
    const facilitatorName = this.handles.meta.get(YJS_META_FIELD_FACILITATOR_NAME);
    const votesPerParticipant = this.handles.meta.get(YJS_META_FIELD_VOTES_PER_PARTICIPANT);
    const timer = this.handles.meta.get(YJS_META_FIELD_TIMER);

    if (
      typeof name !== 'string' ||
      typeof createdAt !== 'string' ||
      typeof templateId !== 'string' ||
      typeof phase !== 'string' ||
      typeof votesPerParticipant !== 'number' ||
      timer === undefined ||
      timer === null
    ) {
      return null;
    }

    // Validate templateId maps to a known template — throws if unknown.
    getTemplateById(templateId as IRetroMeta['template']);

    return {
      name,
      createdAt: createdAt as IRetroMeta['createdAt'],
      template: templateId as IRetroMeta['template'],
      phase: phase as IRetroMeta['phase'],
      facilitatorClientId:
        typeof facilitatorClientId === 'number' ? (facilitatorClientId as ClientId) : null,
      facilitatorName: typeof facilitatorName === 'string' ? facilitatorName : '',
      votesPerParticipant,
      timer: timer as IRetroMeta['timer'],
    };
  }

  private readCards(columns: readonly IColumnConfig[]): readonly IRetroCard[] {
    const collected: IRetroCard[] = [];

    columns.forEach(column => {
      const list = this.handles.cards.get(column.id);

      if (list === undefined) {
        return;
      }

      list.forEach(record => {
        collected.push({
          id: record.id as CardId,
          authorClientId: record.authorClientId as ClientId,
          columnId: record.columnId,
          text: record.text,
          createdAt: record.createdAt as IRetroCard['createdAt'],
          groupId: record.groupId === null ? null : (record.groupId as GroupId),
        });
      });
    });

    return collected;
  }

  private readGroups(): readonly IRetroGroup[] {
    const collected: IRetroGroup[] = [];

    this.handles.groups.forEach(groupMap => {
      const id = groupMap.get('id');
      const columnId = groupMap.get('columnId');
      const title = groupMap.get('title');
      const cardIds = groupMap.get('cardIds');

      if (
        typeof id !== 'string' ||
        typeof columnId !== 'string' ||
        typeof title !== 'string' ||
        !Array.isArray(cardIds)
      ) {
        return;
      }

      collected.push({
        id: id as GroupId,
        columnId: columnId as IRetroGroup['columnId'],
        title,
        cardIds: cardIds
          .filter((value): value is string => typeof value === 'string')
          .map(value => value as CardId),
      });
    });

    return collected;
  }

  private readActionItems(): readonly IActionItem[] {
    return this.handles.actionItems.toArray().map(record => ({
      id: record.id as IActionItem['id'],
      text: record.text,
      sourceGroupId: record.sourceGroupId === null ? null : (record.sourceGroupId as GroupId),
      ownerClientId: record.ownerClientId === null ? null : (record.ownerClientId as ClientId),
      createdAt: record.createdAt as IActionItem['createdAt'],
    }));
  }

  private readVotes(): VotesByTarget {
    const collected = new Map<CardId | GroupId, ReadonlyMap<ClientId, number>>();

    this.handles.votes.forEach((perClient, targetId) => {
      const perClientMap = new Map<ClientId, number>();

      perClient.forEach((count, clientId) => {
        const parsedClientId = Number(clientId);

        if (Number.isFinite(parsedClientId) && typeof count === 'number') {
          perClientMap.set(parsedClientId as ClientId, count);
        }
      });

      collected.set(targetId as CardId | GroupId, perClientMap);
    });

    return collected;
  }
}
