import { isNil } from 'lodash-es';

import type { ICardField, ICardState } from './card';
import { allFields } from './card';
import { FIELD_KINDS } from './field-kinds/registry';
import { templateOf } from './templates/registry';

const LAST_DIGITS = 4;
const MASK = '•••• ';
const NON_DIGIT = /\D/g;

const SUBTITLES = new WeakMap<ICardState, string | null>();

function firstValueOf(field: ICardField): string {
  return field.value.cardinality === 'single' ? field.value.value : (field.value.values[0] ?? '');
}

function subtitleOf(card: ICardState): string | null {
  const kind = templateOf(card.templateId).subtitleFieldKind;
  if (isNil(kind)) {
    return null;
  }
  const field = allFields(card).find(
    candidate => candidate.spec.kind === kind && firstValueOf(candidate).trim() !== ''
  );
  if (isNil(field)) {
    return null;
  }
  const value = firstValueOf(field);
  if (kind === 'card-number') {
    return `${MASK}${value.replace(NON_DIGIT, '').slice(-LAST_DIGITS)}`;
  }
  return field.sensitive ? null : FIELD_KINDS[kind].format(value, field.spec);
}

/**
 * The list's second line: the template's subtitle field, a
 * card number as `•••• 1234`, never a secret. Cached per card object, like
 * every derivation the list reads.
 */
export function cardSubtitle(card: ICardState): string | null {
  if (!SUBTITLES.has(card)) {
    SUBTITLES.set(card, subtitleOf(card));
  }
  return SUBTITLES.get(card) ?? null;
}
