import { assertNever } from '@frozik/utils/assert/assertNever';
import type { ICardState } from '@frozik/vault/model/card';
import { allFields } from '@frozik/vault/model/card';
import type { TCombineAspect } from '@frozik/vault/model/card-combine';
import type { TCardChange } from '@frozik/vault/model/card-diff';
import type { TFieldId } from '@frozik/vault/model/ids';

import type { TEditorTexts } from './editor-texts';

/** One line of the conflict dialog; a secret's value never shows, only its label. */
export function changeText(texts: TEditorTexts, change: TCardChange): string {
  const t = texts.conflict.changes;
  switch (change.kind) {
    case 'title':
      return t.title(change.before, change.after);
    case 'field-added':
      return t.fieldAdded(change.field.label);
    case 'field-removed':
      return t.fieldRemoved(change.field.label);
    case 'field-changed':
      return t.fieldChanged(change.after.label);
    case 'flag':
      return t.flag(texts.conflict.aspects[change.flag]);
    case 'appearance':
      return t.appearance;
    case 'groups':
      return t.groups;
    case 'tabs':
      return t.tabs;
    default:
      return assertNever(change);
  }
}

/** A stable, unique React key for one difference: two fields may share a label, never an id. */
export function changeKey(change: TCardChange): string {
  switch (change.kind) {
    case 'field-added':
    case 'field-removed':
      return `${change.kind}:${change.field.id}`;
    case 'field-changed':
      return `${change.kind}:${change.fieldId}`;
    case 'flag':
      return `flag:${change.flag}`;
    case 'appearance':
      return `appearance:${change.aspect}`;
    case 'title':
    case 'groups':
    case 'tabs':
      return change.kind;
    default:
      return assertNever(change);
  }
}

const FIELD_PREFIX = 'field:';

function isFieldAspect(aspect: TCombineAspect): aspect is `field:${TFieldId}` {
  return aspect.startsWith(FIELD_PREFIX);
}

/** The name of a part of the card both sides changed: a field by its label as it reads in either version. */
export function aspectText(
  texts: TEditorTexts,
  aspect: TCombineAspect,
  mine: ICardState,
  theirs: ICardState
): string {
  if (!isFieldAspect(aspect)) {
    return texts.conflict.aspects[aspect];
  }
  const fieldId = aspect.slice(FIELD_PREFIX.length);
  const field = [...allFields(mine), ...allFields(theirs)].find(
    candidate => candidate.id === fieldId
  );
  return field?.label ?? fieldId;
}
