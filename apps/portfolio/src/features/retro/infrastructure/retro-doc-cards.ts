import { isNil } from 'lodash-es';
import * as Y from 'yjs';

import type { CardId, ColumnId, GroupId } from '../domain/types';
import { readGroupCardIds } from './retro-doc-reader';
import type { IRetroDocHandles, IYjsCardRecord } from './yjs-schema';
import {
  YJS_GROUP_FIELD_CARD_IDS,
  YJS_GROUP_FIELD_COLUMN_ID,
  YJS_GROUP_FIELD_ID,
  YJS_GROUP_FIELD_TITLE,
} from './yjs-schema';

export interface ICardLocation {
  readonly columnId: ColumnId;
  readonly index: number;
  /** The stored record: absence is `null` on the wire and `undefined` in the domain. */
  readonly record: IYjsCardRecord;
}

/** Fewer members than this and a group is no group: it dissolves. */
const MIN_GROUP_SIZE = 2;

/** These run inside a transaction the caller opened; every one is a plain CRDT step. */
export function findCardLocation(
  handles: IRetroDocHandles,
  cardId: CardId
): ICardLocation | undefined {
  let result: ICardLocation | undefined;
  handles.cards.forEach((list, columnId) => {
    if (!isNil(result)) {
      return;
    }
    for (let index = 0; index < list.length; index++) {
      const record = list.get(index);
      if (record.id === cardId) {
        result = { columnId: columnId as ColumnId, index, record };
        return;
      }
    }
  });
  return result;
}

/** Replaces the record at a location in place — Y.Array has no update, only delete and insert. */
export function replaceCardRecord(
  handles: IRetroDocHandles,
  location: ICardLocation,
  record: IYjsCardRecord
): void {
  const list = handles.cards.get(location.columnId);
  if (list !== undefined) {
    list.delete(location.index, 1);
    list.insert(location.index, [record]);
  }
}

export function clearVotesFor(handles: IRetroDocHandles, targetId: CardId | GroupId): void {
  handles.votes.delete(targetId);
}

/** The card's group, minting a fresh one around the card when it has none. */
export function ensureGroupForCard(handles: IRetroDocHandles, location: ICardLocation): string {
  if (location.record.groupId !== null) {
    return location.record.groupId;
  }
  const groupId = crypto.randomUUID();
  const groupMap = new Y.Map<unknown>();
  groupMap.set(YJS_GROUP_FIELD_ID, groupId);
  groupMap.set(YJS_GROUP_FIELD_COLUMN_ID, location.record.columnId);
  groupMap.set(YJS_GROUP_FIELD_TITLE, '');
  groupMap.set(YJS_GROUP_FIELD_CARD_IDS, [location.record.id]);
  handles.groups.set(groupId, groupMap);
  replaceCardRecord(handles, location, { ...location.record, groupId });
  return groupId;
}

export function addCardToGroup(handles: IRetroDocHandles, groupId: GroupId, cardId: CardId): void {
  const groupMap = handles.groups.get(groupId);
  if (groupMap === undefined) {
    return;
  }
  const cardIds = readGroupCardIds(groupMap);
  if (!cardIds.includes(cardId)) {
    groupMap.set(YJS_GROUP_FIELD_CARD_IDS, [...cardIds, cardId]);
  }
}

/**
 * Takes a card out of its group. A group left with one member dissolves: the
 * sibling's `groupId` is cleared, the map dropped and the group's votes with it.
 */
export function removeCardFromGroup(
  handles: IRetroDocHandles,
  cardId: CardId,
  groupId: GroupId
): void {
  const groupMap = handles.groups.get(groupId);
  if (groupMap === undefined) {
    return;
  }
  const nextCardIds = readGroupCardIds(groupMap).filter(id => id !== cardId);

  if (nextCardIds.length >= MIN_GROUP_SIZE) {
    groupMap.set(YJS_GROUP_FIELD_CARD_IDS, nextCardIds);
    return;
  }

  const [lastCardId] = nextCardIds;
  const lastLocation = isNil(lastCardId)
    ? undefined
    : findCardLocation(handles, lastCardId as CardId);
  if (!isNil(lastLocation)) {
    replaceCardRecord(handles, lastLocation, { ...lastLocation.record, groupId: null });
  }
  handles.groups.delete(groupId);
  clearVotesFor(handles, groupId);
}
