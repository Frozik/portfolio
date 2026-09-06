import type { ISO } from '@frozik/utils/date/types';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';
import * as Y from 'yjs';

import type {
  ActionItemId,
  CardId,
  ClientId,
  ColumnId,
  GroupId,
  IRetroSnapshot,
  ITimerState,
  RetroPhase,
} from '../domain/types';
import {
  addCardToGroup,
  clearVotesFor,
  ensureGroupForCard,
  findCardLocation,
  removeCardFromGroup,
  replaceCardRecord,
} from './retro-doc-cards';
import { readRetroSnapshot } from './retro-doc-reader';
import type { IInitRetroDocInput, IRetroDocHandles, IYjsTimerRecord } from './yjs-schema';
import {
  getRetroHandles,
  initRetroDoc,
  YJS_GROUP_FIELD_COLUMN_ID,
  YJS_META_FIELD_FACILITATOR_CLIENT_ID,
  YJS_META_FIELD_FACILITATOR_NAME,
  YJS_META_FIELD_PHASE,
  YJS_META_FIELD_TIMER,
} from './yjs-schema';

/**
 * The single place where a retro `Y.Doc` is written to, and read from through
 * `readRetroSnapshot`. Every method is a plain CRDT operation with no
 * framework ties: callers pass the identity/authorization decisions in as
 * arguments and receive plain-JS projections back. Keeping Yjs behind this
 * boundary means the document semantics (group dissolution, vote cleanup,
 * card relocation) can be exercised in unit tests against a bare `new Y.Doc()`.
 */
export class RetroDocGateway {
  private readonly handles: IRetroDocHandles;

  constructor(private readonly doc: Y.Doc) {
    this.handles = getRetroHandles(doc);
  }

  /**
   * Observe every committed transaction (local or remote). Returns the
   * unsubscribe function — callers must invoke it before destroying the doc.
   */
  subscribe(onAfterTransaction: () => void): () => void {
    this.doc.on('afterTransaction', onAfterTransaction);
    return (): void => {
      this.doc.off('afterTransaction', onAfterTransaction);
    };
  }

  initializeIfMissing(input: IInitRetroDocInput): void {
    initRetroDoc(this.handles, input);
  }

  buildSnapshot(): IRetroSnapshot | undefined {
    return readRetroSnapshot(this.handles);
  }

  addCard(input: {
    readonly columnId: ColumnId;
    readonly authorClientId: ClientId;
    readonly text: string;
  }): void {
    const trimmed = input.text.trim();
    const cards = this.handles.cards.get(input.columnId);
    if (trimmed.length === 0 || cards === undefined) {
      return;
    }
    this.doc.transact(() => {
      cards.push([
        {
          id: crypto.randomUUID() as CardId,
          authorClientId: input.authorClientId,
          columnId: input.columnId,
          text: trimmed,
          createdAt: Temporal.Now.instant().toString() as ISO,
          groupId: null,
        },
      ]);
    });
  }

  deleteCard(cardId: CardId): void {
    this.doc.transact(() => {
      const location = findCardLocation(this.handles, cardId);
      if (isNil(location)) {
        return;
      }
      if (location.record.groupId !== null) {
        removeCardFromGroup(this.handles, cardId, location.record.groupId as GroupId);
      }
      this.handles.cards.get(location.columnId)?.delete(location.index, 1);
    });
  }

  /** Text edits are author-only — the check is enforced against doc data. */
  editCard(input: {
    readonly cardId: CardId;
    readonly authorClientId: ClientId;
    readonly text: string;
  }): void {
    const trimmed = input.text.trim();
    if (trimmed.length === 0) {
      return;
    }
    this.doc.transact(() => {
      const location = findCardLocation(this.handles, input.cardId);
      if (isNil(location) || location.record.authorClientId !== input.authorClientId) {
        return;
      }
      replaceCardRecord(this.handles, location, { ...location.record, text: trimmed });
    });
  }

  moveCardToColumn(input: {
    readonly cardId: CardId;
    readonly targetColumnId: ColumnId;
    readonly targetIndex: number;
  }): void {
    this.doc.transact(() => {
      const location = findCardLocation(this.handles, input.cardId);
      if (isNil(location)) {
        return;
      }
      if (location.record.groupId !== null) {
        removeCardFromGroup(this.handles, input.cardId, location.record.groupId as GroupId);
      }
      const sourceList = this.handles.cards.get(location.columnId);
      const targetList = this.handles.cards.get(input.targetColumnId);
      if (sourceList === undefined || targetList === undefined) {
        return;
      }
      sourceList.delete(location.index, 1);
      const clampedIndex = Math.max(0, Math.min(input.targetIndex, targetList.length));
      targetList.insert(clampedIndex, [
        { ...location.record, columnId: input.targetColumnId, groupId: null },
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
    this.doc.transact(() => {
      const target = findCardLocation(this.handles, targetId);
      const dragged = findCardLocation(this.handles, draggedId);
      if (isNil(target) || isNil(dragged)) {
        return;
      }

      if (dragged.record.groupId !== null && dragged.record.groupId !== target.record.groupId) {
        removeCardFromGroup(this.handles, draggedId, dragged.record.groupId as GroupId);
      }

      // Drop per-card votes: once inside a group the card is no longer a
      // vote target, and orphaned entries would count nowhere.
      clearVotesFor(this.handles, draggedId);
      clearVotesFor(this.handles, targetId);

      const groupId = ensureGroupForCard(this.handles, target) as GroupId;
      const groupMap = this.handles.groups.get(groupId);
      if (groupMap === undefined) {
        return;
      }
      addCardToGroup(this.handles, groupId, draggedId);

      const groupColumnId =
        (groupMap.get(YJS_GROUP_FIELD_COLUMN_ID) as ColumnId | undefined) ?? target.record.columnId;

      // Re-read the dragged location — `removeCardFromGroup` may have mutated
      // the card record (when the previous group dissolved into a singleton
      // it flipped the sibling's groupId, not the dragged card's).
      const draggedAfter = findCardLocation(this.handles, draggedId);
      if (isNil(draggedAfter)) {
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

  /**
   * Move a card to an absolute index inside its (or another) column's Y.Array,
   * optionally attaching it to a target group. Used for gap-based reordering:
   * the UI emits the Y.Array index where the card should land and the target
   * group membership. The card may be reordered within the same column/group,
   * moved between columns or groups, or detached from its old group (which is
   * cleaned up if it drops below two members).
   */
  moveCardToPosition(input: {
    readonly cardId: CardId;
    readonly targetColumnId: ColumnId;
    readonly targetIndex: number;
    readonly targetGroupId: GroupId | undefined;
  }): void {
    this.doc.transact(() => {
      const location = findCardLocation(this.handles, input.cardId);
      if (isNil(location)) {
        return;
      }

      const previousGroupId = location.record.groupId ?? undefined;
      if (!isNil(previousGroupId) && previousGroupId !== input.targetGroupId) {
        removeCardFromGroup(this.handles, input.cardId, previousGroupId as GroupId);
      }

      const latestLocation = findCardLocation(this.handles, input.cardId);
      if (isNil(latestLocation)) {
        return;
      }
      const sourceList = this.handles.cards.get(latestLocation.columnId);
      const destList = this.handles.cards.get(input.targetColumnId);
      if (sourceList === undefined || destList === undefined) {
        return;
      }
      sourceList.delete(latestLocation.index, 1);

      // Removing the card first shifts every later index of the same list down by one.
      const isMovingDownSameList =
        latestLocation.columnId === input.targetColumnId &&
        latestLocation.index < input.targetIndex;
      const adjustedIndex = Math.max(
        0,
        Math.min(isMovingDownSameList ? input.targetIndex - 1 : input.targetIndex, destList.length)
      );
      destList.insert(adjustedIndex, [
        {
          ...latestLocation.record,
          columnId: input.targetColumnId,
          groupId: input.targetGroupId ?? null,
        },
      ]);

      if (!isNil(input.targetGroupId) && previousGroupId !== input.targetGroupId) {
        addCardToGroup(this.handles, input.targetGroupId, input.cardId);
        clearVotesFor(this.handles, input.cardId);
      }
    });
  }

  setPhase(phase: RetroPhase): void {
    this.doc.transact(() => {
      this.handles.meta.set(YJS_META_FIELD_PHASE, phase);
    });
  }

  setTimer(timer: ITimerState): void {
    const record: IYjsTimerRecord = {
      durationMs: timer.durationMs,
      startedAt: timer.startedAt ?? null,
      pausedRemainingMs: timer.pausedRemainingMs ?? null,
    };
    this.doc.transact(() => {
      this.handles.meta.set(YJS_META_FIELD_TIMER, record);
    });
  }

  setFacilitator(clientId: ClientId, name: string): void {
    this.doc.transact(() => {
      this.handles.meta.set(YJS_META_FIELD_FACILITATOR_CLIENT_ID, clientId);
      this.handles.meta.set(YJS_META_FIELD_FACILITATOR_NAME, name);
    });
  }

  setFacilitatorName(name: string): void {
    this.doc.transact(() => {
      this.handles.meta.set(YJS_META_FIELD_FACILITATOR_NAME, name);
    });
  }

  addVote(targetId: CardId | GroupId, clientId: ClientId): void {
    this.doc.transact(() => {
      let perClient = this.handles.votes.get(targetId);
      if (perClient === undefined) {
        perClient = new Y.Map<number>();
        this.handles.votes.set(targetId, perClient);
      }
      const key = String(clientId);
      perClient.set(key, (perClient.get(key) ?? 0) + 1);
    });
  }

  removeVote(targetId: CardId | GroupId, clientId: ClientId): void {
    this.doc.transact(() => {
      const perClient = this.handles.votes.get(targetId);
      if (perClient === undefined) {
        return;
      }
      const key = String(clientId);
      const current = perClient.get(key) ?? 0;
      if (current <= 1) {
        perClient.delete(key);
      } else {
        perClient.set(key, current - 1);
      }
    });
  }

  addActionItem(text: string, sourceGroupId: GroupId | undefined): void {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return;
    }
    this.doc.transact(() => {
      this.handles.actionItems.push([
        {
          id: crypto.randomUUID() as ActionItemId,
          text: trimmed,
          sourceGroupId: sourceGroupId ?? null,
          ownerClientId: null,
          createdAt: Temporal.Now.instant().toString() as ISO,
        },
      ]);
    });
  }

  deleteActionItem(id: ActionItemId): void {
    this.doc.transact(() => {
      const index = this.handles.actionItems.toArray().findIndex(record => record.id === id);
      if (index >= 0) {
        this.handles.actionItems.delete(index, 1);
      }
    });
  }
}
