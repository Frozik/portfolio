import type { ISO } from '@frozik/utils';
import { Temporal } from '@js-temporal/polyfill';
import * as Y from 'yjs';

import { DEFAULT_BRAINSTORM_DURATION_MS } from './constants';
import type { ClientId, ColumnId, IColumnConfig, ITemplateConfig } from './types';
import { ERetroPhase } from './types';

/**
 * Top-level Y.Doc key layout for a single retro room.
 *
 * The root-level shape is declared here so domain and application layers
 * can reason about room state without re-deriving key strings. The Yjs
 * import is kept minimal: helpers below expose typed root handles and a
 * single idempotent initializer.
 */

export const YJS_KEY_META = 'meta';
export const YJS_KEY_COLUMNS = 'columns';
/** Map<ColumnId, Y.Array<CardRecord>> — cards grouped by column. */
export const YJS_KEY_CARDS = 'cards';
export const YJS_KEY_GROUPS = 'groups';
export const YJS_KEY_ACTION_ITEMS = 'actionItems';
/** Map<CardId | GroupId, Y.Map<ClientId, number>> — per-target per-client vote counts. */
export const YJS_KEY_VOTES = 'votes';

export const YJS_META_FIELD_NAME = 'name';
export const YJS_META_FIELD_CREATED_AT = 'createdAt';
export const YJS_META_FIELD_TEMPLATE = 'template';
export const YJS_META_FIELD_PHASE = 'phase';
export const YJS_META_FIELD_FACILITATOR_CLIENT_ID = 'facilitatorClientId';
export const YJS_META_FIELD_FACILITATOR_NAME = 'facilitatorName';
export const YJS_META_FIELD_VOTES_PER_PARTICIPANT = 'votesPerParticipant';
export const YJS_META_FIELD_TIMER = 'timer';

/**
 * Flat shape of a single card as stored inside `Y.Array`.
 *
 * Kept as a plain object (not a Y.Map) because we only edit the `text`
 * field in-place and want to avoid the nested-Y-type overhead.
 */
export interface IYjsCardRecord {
  id: string;
  authorClientId: number;
  columnId: ColumnId;
  text: string;
  createdAt: string;
  groupId: string | null;
}

export interface IYjsGroupRecord {
  id: string;
  columnId: ColumnId;
  title: string;
  cardIds: string[];
}

export interface IYjsActionItemRecord {
  id: string;
  text: string;
  sourceGroupId: string | null;
  ownerClientId: number | null;
  createdAt: string;
}

export interface IYjsTimerRecord {
  durationMs: number;
  startedAt: number | null;
  pausedRemainingMs: number | null;
}

/**
 * Typed root-level handles to every shared collection a retro room uses.
 * Obtained via {@link getRetroHandles} once per doc — consumers then pass
 * the bundle around instead of stringly-indexing the doc.
 */
export interface IRetroDocHandles {
  readonly doc: Y.Doc;
  readonly meta: Y.Map<unknown>;
  readonly columns: Y.Array<IColumnConfig>;
  readonly cards: Y.Map<Y.Array<IYjsCardRecord>>;
  readonly groups: Y.Map<Y.Map<unknown>>;
  readonly votes: Y.Map<Y.Map<number>>;
  readonly actionItems: Y.Array<IYjsActionItemRecord>;
}

export function getRetroHandles(doc: Y.Doc): IRetroDocHandles {
  return {
    doc,
    meta: doc.getMap<unknown>(YJS_KEY_META),
    columns: doc.getArray<IColumnConfig>(YJS_KEY_COLUMNS),
    cards: doc.getMap<Y.Array<IYjsCardRecord>>(YJS_KEY_CARDS),
    groups: doc.getMap<Y.Map<unknown>>(YJS_KEY_GROUPS),
    votes: doc.getMap<Y.Map<number>>(YJS_KEY_VOTES),
    actionItems: doc.getArray<IYjsActionItemRecord>(YJS_KEY_ACTION_ITEMS),
  };
}

export interface IInitRetroDocInput {
  readonly name: string;
  readonly template: ITemplateConfig;
  readonly facilitatorClientId: ClientId;
  readonly facilitatorName: string;
  readonly votesPerParticipant: number;
}

/**
 * Populate a fresh retro doc with meta, columns, and per-column card
 * arrays. The function is idempotent: if `meta.createdAt` is already set
 * the call is a no-op, which lets every participant run it on mount
 * without fighting over who "creates" the room.
 */
export function initRetroDoc(handles: IRetroDocHandles, init: IInitRetroDocInput): void {
  if (handles.meta.has(YJS_META_FIELD_CREATED_AT)) {
    return;
  }

  const createdAtIso = Temporal.Now.instant().toString() as ISO;

  const timer: IYjsTimerRecord = {
    durationMs: DEFAULT_BRAINSTORM_DURATION_MS,
    startedAt: null,
    pausedRemainingMs: null,
  };

  handles.doc.transact(() => {
    handles.meta.set(YJS_META_FIELD_NAME, init.name);
    handles.meta.set(YJS_META_FIELD_CREATED_AT, createdAtIso);
    handles.meta.set(YJS_META_FIELD_TEMPLATE, init.template.id);
    handles.meta.set(YJS_META_FIELD_PHASE, ERetroPhase.Brainstorm);
    handles.meta.set(YJS_META_FIELD_FACILITATOR_CLIENT_ID, init.facilitatorClientId);
    handles.meta.set(YJS_META_FIELD_FACILITATOR_NAME, init.facilitatorName);
    handles.meta.set(YJS_META_FIELD_VOTES_PER_PARTICIPANT, init.votesPerParticipant);
    handles.meta.set(YJS_META_FIELD_TIMER, timer);

    handles.columns.push([...init.template.columns]);

    init.template.columns.forEach(column => {
      handles.cards.set(column.id, new Y.Array<IYjsCardRecord>());
    });
  });
}
