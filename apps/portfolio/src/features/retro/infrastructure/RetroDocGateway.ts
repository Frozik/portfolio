import type { ISO } from '@frozik/utils/date/types';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';
import * as Y from 'yjs';

import { createRetroSnapshot } from '../domain/retro-snapshot';
import { getTemplateById } from '../domain/templates';
import type {
  ActionItemId,
  CardId,
  ClientId,
  ColumnId,
  ERetroPhase,
  GroupId,
  IActionItem,
  IColumnConfig,
  IRetroCard,
  IRetroGroup,
  IRetroMeta,
  IRetroSnapshot,
  ITimerState,
  VotesByTarget,
} from '../domain/types';
import type { IInitRetroDocInput, IRetroDocHandles } from '../domain/yjs-schema';
import {
  getRetroHandles,
  initRetroDoc,
  YJS_GROUP_FIELD_CARD_IDS,
  YJS_GROUP_FIELD_COLUMN_ID,
  YJS_GROUP_FIELD_ID,
  YJS_GROUP_FIELD_TITLE,
  YJS_META_FIELD_CREATED_AT,
  YJS_META_FIELD_FACILITATOR_CLIENT_ID,
  YJS_META_FIELD_FACILITATOR_NAME,
  YJS_META_FIELD_NAME,
  YJS_META_FIELD_PHASE,
  YJS_META_FIELD_TEMPLATE,
  YJS_META_FIELD_TIMER,
  YJS_META_FIELD_VOTES_PER_PARTICIPANT,
} from '../domain/yjs-schema';

interface ICardLocation {
  readonly columnId: ColumnId;
  readonly index: number;
  readonly record: IRetroCard;
}

/**
 * The single place where a retro `Y.Doc` is read from and written to.
 *
 * Every method is a plain CRDT operation with no framework ties: callers
 * pass the identity/authorization decisions in as arguments and receive
 * plain-JS projections back. Keeping Yjs behind this boundary means the
 * document semantics (group dissolution, vote cleanup, card relocation)
 * can be exercised in unit tests against a bare `new Y.Doc()`.
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

  buildSnapshot(): IRetroSnapshot | null {
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

  addCard(input: {
    readonly columnId: ColumnId;
    readonly authorClientId: ClientId;
    readonly text: string;
  }): void {
    const trimmed = input.text.trim();
    if (trimmed.length === 0) {
      return;
    }
    const cards = this.handles.cards.get(input.columnId);
    if (cards === undefined) {
      return;
    }
    const card = {
      id: crypto.randomUUID() as CardId,
      authorClientId: input.authorClientId,
      columnId: input.columnId,
      text: trimmed,
      createdAt: Temporal.Now.instant().toString() as ISO,
      groupId: null,
    };
    this.doc.transact(() => {
      cards.push([card]);
    });
  }

  deleteCard(cardId: CardId): void {
    this.doc.transact(() => {
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
      this.handles.cards.forEach(list => {
        for (let index = 0; index < list.length; index++) {
          const record = list.get(index);
          if (record.id !== input.cardId) {
            continue;
          }
          if (record.authorClientId !== input.authorClientId) {
            return;
          }
          list.delete(index, 1);
          list.insert(index, [{ ...record, text: trimmed }]);
          return;
        }
      });
    });
  }

  moveCardToColumn(input: {
    readonly cardId: CardId;
    readonly targetColumnId: ColumnId;
    readonly targetIndex: number;
  }): void {
    this.doc.transact(() => {
      const location = this.findCardLocation(input.cardId);
      if (location === null) {
        return;
      }
      if (location.record.groupId !== null) {
        this.removeCardFromGroup(input.cardId, location.record.groupId as GroupId);
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
      const target = this.findCardLocation(targetId);
      const dragged = this.findCardLocation(draggedId);
      if (target === null || dragged === null) {
        return;
      }

      if (dragged.record.groupId !== null && dragged.record.groupId !== target.record.groupId) {
        this.removeCardFromGroup(draggedId, dragged.record.groupId as GroupId);
      }

      // Drop per-card votes: once inside a group the card is no longer a
      // vote target, and orphaned entries would count nowhere.
      this.clearVotesFor(draggedId);
      this.clearVotesFor(targetId);

      const groupId = this.ensureGroupForCard(target) as GroupId;
      const groupMap = this.handles.groups.get(groupId);
      if (groupMap === undefined) {
        return;
      }

      const currentCardIds = this.readGroupCardIds(groupMap);
      if (!currentCardIds.includes(draggedId)) {
        groupMap.set(YJS_GROUP_FIELD_CARD_IDS, [...currentCardIds, draggedId]);
      }

      const groupColumnId =
        (groupMap.get(YJS_GROUP_FIELD_COLUMN_ID) as ColumnId | undefined) ?? target.record.columnId;

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

  /**
   * Move a card to an absolute index inside its (or another) column's Y.Array,
   * optionally attaching it to a target group. Used for gap-based reordering:
   * the UI emits the Y.Array index where the card should land and the target
   * group membership. The card may be:
   *   - reordered within the same column/group (no group-membership change);
   *   - moved between columns or groups (group-membership updates);
   *   - detached from its old group (old group is cleaned up if it drops
   *     below two members).
   */
  moveCardToPosition(input: {
    readonly cardId: CardId;
    readonly targetColumnId: ColumnId;
    readonly targetIndex: number;
    readonly targetGroupId: GroupId | null;
  }): void {
    this.doc.transact(() => {
      const location = this.findCardLocation(input.cardId);
      if (location === null) {
        return;
      }

      const previousGroupId = location.record.groupId;
      if (previousGroupId !== null && previousGroupId !== input.targetGroupId) {
        this.removeCardFromGroup(input.cardId, previousGroupId as GroupId);
      }

      const latestLocation = this.findCardLocation(input.cardId);
      if (latestLocation === null) {
        return;
      }

      const sourceList = this.handles.cards.get(latestLocation.columnId);
      const destList = this.handles.cards.get(input.targetColumnId);
      if (sourceList === undefined || destList === undefined) {
        return;
      }

      sourceList.delete(latestLocation.index, 1);

      let adjustedIndex = input.targetIndex;
      if (
        latestLocation.columnId === input.targetColumnId &&
        latestLocation.index < input.targetIndex
      ) {
        adjustedIndex -= 1;
      }
      adjustedIndex = Math.max(0, Math.min(adjustedIndex, destList.length));

      destList.insert(adjustedIndex, [
        {
          ...latestLocation.record,
          columnId: input.targetColumnId,
          groupId: input.targetGroupId,
        },
      ]);

      if (input.targetGroupId !== null && previousGroupId !== input.targetGroupId) {
        const groupMap = this.handles.groups.get(input.targetGroupId);
        if (groupMap !== undefined) {
          const cardIds = this.readGroupCardIds(groupMap);
          if (!cardIds.includes(input.cardId)) {
            groupMap.set(YJS_GROUP_FIELD_CARD_IDS, [...cardIds, input.cardId]);
          }
        }
        this.clearVotesFor(input.cardId);
      }
    });
  }

  setPhase(phase: ERetroPhase): void {
    this.doc.transact(() => {
      this.handles.meta.set(YJS_META_FIELD_PHASE, phase);
    });
  }

  setTimer(timer: ITimerState): void {
    this.doc.transact(() => {
      this.handles.meta.set(YJS_META_FIELD_TIMER, timer);
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
      const current = perClient.get(key) ?? 0;
      perClient.set(key, current + 1);
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

  addActionItem(text: string, sourceGroupId: GroupId | null): void {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return;
    }
    this.doc.transact(() => {
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
    this.doc.transact(() => {
      for (let index = 0; index < this.handles.actionItems.length; index++) {
        const record = this.handles.actionItems.get(index);
        if (record.id === id) {
          this.handles.actionItems.delete(index, 1);
          return;
        }
      }
    });
  }

  private findCardLocation(cardId: CardId): ICardLocation | null {
    let result: ICardLocation | null = null;
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

  private ensureGroupForCard(location: ICardLocation): string {
    if (location.record.groupId !== null) {
      return location.record.groupId;
    }
    const groupId = crypto.randomUUID();
    const groupMap = new Y.Map<unknown>();
    groupMap.set(YJS_GROUP_FIELD_ID, groupId);
    groupMap.set(YJS_GROUP_FIELD_COLUMN_ID, location.record.columnId);
    groupMap.set(YJS_GROUP_FIELD_TITLE, '');
    groupMap.set(YJS_GROUP_FIELD_CARD_IDS, [location.record.id]);
    this.handles.groups.set(groupId, groupMap);

    const list = this.handles.cards.get(location.columnId);
    if (list !== undefined) {
      list.delete(location.index, 1);
      list.insert(location.index, [{ ...location.record, groupId: groupId as GroupId }]);
    }
    return groupId;
  }

  private clearVotesFor(targetId: CardId | GroupId): void {
    this.handles.votes.delete(targetId);
  }

  private removeCardFromGroup(cardId: CardId, groupId: GroupId): void {
    const groupMap = this.handles.groups.get(groupId);
    if (groupMap === undefined) {
      return;
    }
    const nextCardIds = this.readGroupCardIds(groupMap).filter(id => id !== cardId);

    if (nextCardIds.length >= 2) {
      groupMap.set(YJS_GROUP_FIELD_CARD_IDS, nextCardIds);
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
    this.clearVotesFor(groupId);
  }

  private readGroupCardIds(groupMap: Y.Map<unknown>): readonly string[] {
    const raw = groupMap.get(YJS_GROUP_FIELD_CARD_IDS);
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter((value): value is string => typeof value === 'string');
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
      isNil(timer)
    ) {
      return null;
    }

    // Resolve templateId to a known template. Unknown ids (legacy templates
    // that were renamed or removed) fall back to the first configured
    // template inside getTemplateById.
    const template = getTemplateById(templateId);

    return {
      name,
      createdAt: createdAt as IRetroMeta['createdAt'],
      template: template.id as IRetroMeta['template'],
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
      const id = groupMap.get(YJS_GROUP_FIELD_ID);
      const columnId = groupMap.get(YJS_GROUP_FIELD_COLUMN_ID);
      const title = groupMap.get(YJS_GROUP_FIELD_TITLE);
      const cardIds = groupMap.get(YJS_GROUP_FIELD_CARD_IDS);

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
