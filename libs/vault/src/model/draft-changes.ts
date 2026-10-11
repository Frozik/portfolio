import type { ICardState } from './card';
import { allFields, fieldValues } from './card';
import { diffCardStates } from './card-diff';
import type { TCardDraft } from './draft';
import type { TFieldId } from './ids';

/** What an edit in progress has changed, for the editor and the list to mark. */
export interface IDraftChanges {
  readonly title: boolean;
  readonly fields: ReadonlySet<TFieldId>;
}

function filledIn(card: ICardState): IDraftChanges {
  return {
    title: card.title !== '',
    fields: new Set(
      allFields(card)
        .filter(field => fieldValues(field).length > 0)
        .map(field => field.id)
    ),
  };
}

/**
 * Against the version the edit started from: the fields added or changed
 * (value, label, kind, secrecy) and the title. A new card has nothing to
 * compare with, so what is filled in counts as changed.
 */
export function draftChanges(draft: TCardDraft): IDraftChanges {
  if (draft.kind === 'new') {
    return filledIn(draft.card);
  }
  const changes = diffCardStates(draft.base, draft.card);
  return {
    title: changes.some(change => change.kind === 'title'),
    fields: new Set(
      changes.flatMap(change => {
        switch (change.kind) {
          case 'field-added':
            return [change.field.id];
          case 'field-changed':
            return [change.fieldId];
          default:
            return [];
        }
      })
    ),
  };
}
