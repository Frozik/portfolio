import { isEqual, isNil, xor } from 'lodash-es';

import type { ICardField, ICardState } from './card';
import { allFields } from './card';
import type { TFieldId, TGroupId } from './ids';

export type TCardFlag = 'favorite' | 'protected' | 'archived' | 'trashed';

/** One difference between two versions of a card, as the conflict dialog lists it. */
export type TCardChange =
  | { readonly kind: 'title'; readonly before: string; readonly after: string }
  | { readonly kind: 'field-added'; readonly field: ICardField }
  | { readonly kind: 'field-removed'; readonly field: ICardField }
  | {
      readonly kind: 'field-changed';
      readonly fieldId: TFieldId;
      readonly before: ICardField;
      readonly after: ICardField;
    }
  | { readonly kind: 'flag'; readonly flag: TCardFlag; readonly after: boolean }
  | { readonly kind: 'appearance'; readonly aspect: 'color' | 'icon' }
  | {
      readonly kind: 'groups';
      readonly added: readonly TGroupId[];
      readonly removed: readonly TGroupId[];
    }
  | { readonly kind: 'tabs' };

function flags(card: ICardState): Readonly<Record<TCardFlag, boolean>> {
  return {
    favorite: card.favorite,
    protected: card.protected,
    archived: !isNil(card.archivedAt),
    trashed: !isNil(card.trashedAt),
  };
}

/** Tab ids, titles and where the given fields sit: the layout, apart from the fields' contents. */
export function tabLayout(card: ICardState, fields: ReadonlySet<TFieldId>): unknown {
  return card.tabs.map(tab => ({
    id: tab.id,
    title: tab.title,
    fields: tab.fields.map(field => field.id).filter(id => fields.has(id)),
  }));
}

function fieldChanges(before: ICardState, after: ICardState): readonly TCardChange[] {
  const beforeFields = new Map(allFields(before).map(field => [field.id, field]));
  const afterFields = new Map(allFields(after).map(field => [field.id, field]));
  const changes: TCardChange[] = [];
  for (const field of afterFields.values()) {
    const previous = beforeFields.get(field.id);
    if (isNil(previous)) {
      changes.push({ kind: 'field-added', field });
    } else if (!isEqual(previous, field)) {
      changes.push({ kind: 'field-changed', fieldId: field.id, before: previous, after: field });
    }
  }
  for (const field of beforeFields.values()) {
    if (!afterFields.has(field.id)) {
      changes.push({ kind: 'field-removed', field });
    }
  }
  return changes;
}

/**
 * What turned `before` into `after`. Values of secret fields
 * travel inside the changes; the view hides them until shown.
 */
export function diffCardStates(before: ICardState, after: ICardState): readonly TCardChange[] {
  const changes: TCardChange[] = [];
  if (before.title !== after.title) {
    changes.push({ kind: 'title', before: before.title, after: after.title });
  }
  changes.push(...fieldChanges(before, after));
  const beforeFlags = flags(before);
  const afterFlags = flags(after);
  for (const flag of ['favorite', 'protected', 'archived', 'trashed'] as const) {
    if (beforeFlags[flag] !== afterFlags[flag]) {
      changes.push({ kind: 'flag', flag, after: afterFlags[flag] });
    }
  }
  if (before.color !== after.color) {
    changes.push({ kind: 'appearance', aspect: 'color' });
  }
  if (!isEqual(before.icon, after.icon)) {
    changes.push({ kind: 'appearance', aspect: 'icon' });
  }
  if (xor(before.groupIds, after.groupIds).length > 0) {
    changes.push({
      kind: 'groups',
      added: after.groupIds.filter(id => !before.groupIds.includes(id)),
      removed: before.groupIds.filter(id => !after.groupIds.includes(id)),
    });
  }
  const common = new Set(
    allFields(before)
      .map(field => field.id)
      .filter(id => allFields(after).some(field => field.id === id))
  );
  if (!isEqual(tabLayout(before, common), tabLayout(after, common))) {
    changes.push({ kind: 'tabs' });
  }
  return changes;
}
