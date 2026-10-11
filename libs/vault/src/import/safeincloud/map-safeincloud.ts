import { isNil } from 'lodash-es';

import type { TCardColor, TFieldKind } from '../../model/card';
import { BANK_CARD_TEMPLATE } from '../../model/templates/bank-card';
import { BLANK_TEMPLATE } from '../../model/templates/blank';
import { INTERNET_ACCOUNT_TEMPLATE } from '../../model/templates/internet-account';
import { NOTE_TEMPLATE } from '../../model/templates/note';
import type { ICardTemplate } from '../../model/templates/template';
import type { IImportBatch, IImportedCard, IImportedField, TImportWarning } from '../imported-card';
import { keyLabel, textLabel } from '../imported-card';
import { extraField, plainCard } from '../template-card';
import type { TSafeInCloudCard, TSafeInCloudDatabase } from './parse-safeincloud';
import { textOf } from './parse-safeincloud';

/** SafeInCloud's field types onto kinds, one to one; an unknown type is text. */
const FIELD_KINDS: ReadonlyMap<string, TFieldKind> = new Map(
  Object.entries({
    login: 'login',
    password: 'password',
    website: 'url',
    one_time_password: 'otp',
    secret: 'secret',
    number: 'text',
    text: 'text',
    expiry: 'expiry-month',
    pin: 'pin',
    phone: 'phone',
    date: 'date',
    email: 'email',
    notes: 'note',
  } satisfies Record<string, TFieldKind>)
);

const COLORS: ReadonlyMap<string, TCardColor> = new Map(
  Object.entries({
    red: 'red',
    orange: 'orange',
    yellow: 'amber',
    green: 'green',
    teal: 'teal',
    blue: 'blue',
    purple: 'violet',
    pink: 'pink',
    gray: 'slate',
    grey: 'slate',
  } satisfies Record<string, TCardColor>)
);

const TRUE = 'true';

function kindOf(type: string | undefined): TFieldKind {
  return FIELD_KINDS.get(type ?? '') ?? 'text';
}

/** SafeInCloud keeps no template per card: the kinds of its fields tell which list icon and subtitle suit it. */
function templateOf(kinds: ReadonlySet<TFieldKind>): ICardTemplate {
  if (kinds.has('url') || kinds.has('login')) {
    return INTERNET_ACCOUNT_TEMPLATE;
  }
  if (kinds.has('expiry-month') && kinds.has('pin')) {
    return BANK_CARD_TEMPLATE;
  }
  return kinds.size === 0 ? NOTE_TEMPLATE : BLANK_TEMPLATE;
}

function fieldsOf(card: TSafeInCloudCard): readonly IImportedField[] {
  const fields = (card.field ?? []).map(field => {
    const kind = kindOf(field.type);
    const value = field.text ?? '';
    return extraField(kind, textLabel(field.name ?? ''), kind === 'url' ? [value] : value);
  });
  const notes = textOf(card.notes);
  return notes === '' ? fields : [...fields, extraField('note', keyLabel('field.notes'), notes)];
}

function cardOf(
  card: TSafeInCloudCard,
  labels: ReadonlyMap<string, string>,
  warnings: TImportWarning[]
): IImportedCard {
  const title = card.title ?? '';
  for (const file of card.file ?? []) {
    warnings.push({ kind: 'file-dropped', card: title, name: file.name ?? '' });
  }
  if ((card.image ?? []).length > 0) {
    warnings.push({ kind: 'file-dropped', card: title, name: '' });
  }
  const kinds = new Set((card.field ?? []).map(field => kindOf(field.type)));
  return plainCard(templateOf(kinds), title, [{ title: null, fields: fieldsOf(card) }], {
    groups: (card.label_id ?? []).flatMap(id => {
      const name = labels.get(textOf(id));
      return isNil(name) ? [] : [name];
    }),
    favorite: card.star === TRUE,
    color: COLORS.get(card.color ?? '') ?? null,
  });
}

/**
 * SafeInCloud: each card with its fields in their order and
 * under their names, labels as groups, the star and the colour; templates
 * and deleted cards stay behind. Attachments do not come along and are reported.
 */
export function importSafeInCloud(database: TSafeInCloudDatabase): IImportBatch {
  const labels = new Map((database.label ?? []).map(({ id, name }) => [id, name]));
  const warnings: TImportWarning[] = [];
  const cards = (database.card ?? [])
    .filter(card => card.template !== TRUE && card.deleted !== TRUE)
    .map(card => cardOf(card, labels, warnings));
  return { source: 'safeincloud', cards, links: [], assets: [], warnings };
}
