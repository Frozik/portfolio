import type { Milliseconds } from '@frozik/utils/date/types';
import { isNil } from 'lodash-es';
import type * as Y from 'yjs';

import { createRetroSnapshot } from '../domain/retro-snapshot';
import { getTemplateById } from '../domain/templates';
import type {
  CardId,
  ClientId,
  GroupId,
  IActionItem,
  IColumnConfig,
  IRetroCard,
  IRetroGroup,
  IRetroMeta,
  IRetroSnapshot,
  VotesByTarget,
} from '../domain/types';
import type { IRetroDocHandles, IYjsTimerRecord } from './yjs-schema';
import {
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
} from './yjs-schema';

/** The ids a group map lists, whatever a peer may have written there. */
export function readGroupCardIds(groupMap: Y.Map<unknown>): readonly string[] {
  const raw = groupMap.get(YJS_GROUP_FIELD_CARD_IDS);
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((value): value is string => typeof value === 'string');
}

function readMeta(handles: IRetroDocHandles): IRetroMeta | undefined {
  const name = handles.meta.get(YJS_META_FIELD_NAME);
  const createdAt = handles.meta.get(YJS_META_FIELD_CREATED_AT);
  const templateId = handles.meta.get(YJS_META_FIELD_TEMPLATE);
  const phase = handles.meta.get(YJS_META_FIELD_PHASE);
  const facilitatorClientId = handles.meta.get(YJS_META_FIELD_FACILITATOR_CLIENT_ID);
  const facilitatorName = handles.meta.get(YJS_META_FIELD_FACILITATOR_NAME);
  const votesPerParticipant = handles.meta.get(YJS_META_FIELD_VOTES_PER_PARTICIPANT);
  const timer = handles.meta.get(YJS_META_FIELD_TIMER);

  if (
    typeof name !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof templateId !== 'string' ||
    typeof phase !== 'string' ||
    typeof votesPerParticipant !== 'number' ||
    isNil(timer)
  ) {
    return undefined;
  }
  const timerRecord = timer as IYjsTimerRecord;

  // Unknown template ids (legacy templates that were renamed or removed) fall
  // back to the first configured template inside getTemplateById.
  const template = getTemplateById(templateId);

  return {
    name,
    createdAt: createdAt as IRetroMeta['createdAt'],
    template: template.id as IRetroMeta['template'],
    phase: phase as IRetroMeta['phase'],
    facilitatorClientId:
      typeof facilitatorClientId === 'number' ? (facilitatorClientId as ClientId) : undefined,
    facilitatorName: typeof facilitatorName === 'string' ? facilitatorName : '',
    votesPerParticipant,
    timer: {
      durationMs: timerRecord.durationMs as Milliseconds,
      startedAt: (timerRecord.startedAt ?? undefined) as Milliseconds | undefined,
      pausedRemainingMs: (timerRecord.pausedRemainingMs ?? undefined) as Milliseconds | undefined,
    },
  };
}

function readCards(
  handles: IRetroDocHandles,
  columns: readonly IColumnConfig[]
): readonly IRetroCard[] {
  const collected: IRetroCard[] = [];

  for (const column of columns) {
    const list = handles.cards.get(column.id);
    if (list === undefined) {
      continue;
    }
    list.forEach(record => {
      collected.push({
        id: record.id as CardId,
        authorClientId: record.authorClientId as ClientId,
        columnId: record.columnId,
        text: record.text,
        createdAt: record.createdAt as IRetroCard['createdAt'],
        groupId: (record.groupId ?? undefined) as GroupId | undefined,
      });
    });
  }

  return collected;
}

function readGroups(handles: IRetroDocHandles): readonly IRetroGroup[] {
  const collected: IRetroGroup[] = [];

  handles.groups.forEach(groupMap => {
    const id = groupMap.get(YJS_GROUP_FIELD_ID);
    const columnId = groupMap.get(YJS_GROUP_FIELD_COLUMN_ID);
    const title = groupMap.get(YJS_GROUP_FIELD_TITLE);

    if (typeof id !== 'string' || typeof columnId !== 'string' || typeof title !== 'string') {
      return;
    }

    collected.push({
      id: id as GroupId,
      columnId: columnId as IRetroGroup['columnId'],
      title,
      cardIds: readGroupCardIds(groupMap).map(value => value as CardId),
    });
  });

  return collected;
}

function readActionItems(handles: IRetroDocHandles): readonly IActionItem[] {
  return handles.actionItems.toArray().map(record => ({
    id: record.id as IActionItem['id'],
    text: record.text,
    sourceGroupId: (record.sourceGroupId ?? undefined) as GroupId | undefined,
    ownerClientId: (record.ownerClientId ?? undefined) as ClientId | undefined,
    createdAt: record.createdAt as IActionItem['createdAt'],
  }));
}

function readVotes(handles: IRetroDocHandles): VotesByTarget {
  const collected = new Map<CardId | GroupId, ReadonlyMap<ClientId, number>>();

  handles.votes.forEach((perClient, targetId) => {
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

/** The plain-JS projection of the whole document, or nothing before it was initialised. */
export function readRetroSnapshot(handles: IRetroDocHandles): IRetroSnapshot | undefined {
  if (!handles.meta.has(YJS_META_FIELD_CREATED_AT)) {
    return undefined;
  }
  const meta = readMeta(handles);
  if (isNil(meta)) {
    return undefined;
  }
  const columns = handles.columns.toArray() as readonly IColumnConfig[];

  return createRetroSnapshot({
    meta,
    columns,
    cards: readCards(handles, columns),
    groups: readGroups(handles),
    actionItems: readActionItems(handles),
    votes: readVotes(handles),
  });
}
