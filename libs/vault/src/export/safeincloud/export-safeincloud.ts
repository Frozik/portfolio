import { XMLBuilder } from 'fast-xml-parser';
import { isNil } from 'lodash-es';

import type { ICardField, IVaultCard, TCardColor, TFieldKind } from '../../model/card';
import { allFields, valuesInUse } from '../../model/card';
import { liveGroupIds } from '../../model/group-edits';
import type { TGroupId } from '../../model/ids';
import type { IVaultDocument } from '../../model/vault-document';

/** Each kind as the SafeInCloud field type that keeps it best; a file has no place in the XML. */
const FIELD_TYPES: Readonly<Record<TFieldKind, string | null>> = {
  text: 'text',
  login: 'login',
  email: 'email',
  phone: 'phone',
  secret: 'secret',
  pin: 'pin',
  otp: 'one_time_password',
  'card-number': 'number',
  cvv: 'pin',
  'expiry-month': 'expiry',
  'expiry-date': 'date',
  date: 'date',
  boolean: 'text',
  iban: 'text',
  bic: 'text',
  'bank-account': 'text',
  'bank-code': 'text',
  select: 'text',
  'security-question': 'text',
  password: 'password',
  url: 'website',
  multiline: 'notes',
  note: 'notes',
  file: null,
};

/** SafeInCloud's own palette has no indigo: the nearest of its colours stands in. */
const COLORS: Readonly<Record<TCardColor, string>> = {
  red: 'red',
  orange: 'orange',
  amber: 'yellow',
  green: 'green',
  teal: 'teal',
  blue: 'blue',
  indigo: 'blue',
  violet: 'purple',
  pink: 'pink',
  slate: 'gray',
};

/** The browser autofill hints SafeInCloud keeps on its own templates' fields; any other is `off`. */
const AUTOFILL: Readonly<Partial<Record<TFieldKind, string>>> = {
  login: 'username',
  email: 'username',
  password: 'current-password',
  url: 'url',
  otp: 'one-time-code',
  'card-number': 'cc-number',
  'expiry-month': 'cc-exp',
  cvv: 'cc-csc',
};

/** SafeInCloud's mark for a card of each of our templates, as its own templates use them. */
const SYMBOLS: Readonly<Record<string, string>> = {
  'internet-account': 'web_site',
  'email-account': 'email',
  'bank-card': 'credit_card',
  'bank-account': 'bank',
  'bank-account-uk': 'bank',
  'bank-account-us': 'bank',
  'bank-account-ru': 'bank',
  document: 'id',
  server: 'key',
  wifi: 'router',
};

/** What the app paints a card in when none was chosen. */
const NO_COLOR = 'gray';

const ATTRIBUTE = '@_';
const TEXT = '#text';

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: ATTRIBUTE,
  textNodeName: TEXT,
  suppressEmptyNode: false,
  // Otherwise `star="true"` is written as a bare `star`, which SafeInCloud reads as no star.
  suppressBooleanAttributes: false,
});

type TElement = Readonly<Record<string, unknown>>;

function fieldElements(field: ICardField): readonly TElement[] {
  const type = field.spec.kind === 'unknown' ? 'text' : FIELD_TYPES[field.spec.kind];
  if (isNil(type)) {
    return [];
  }
  return valuesInUse(field)
    .filter(value => value !== '')
    .map(value => ({
      [`${ATTRIBUTE}name`]: field.label,
      [`${ATTRIBUTE}type`]: type,
      [`${ATTRIBUTE}autofill`]:
        (field.spec.kind === 'unknown' ? undefined : AUTOFILL[field.spec.kind]) ?? 'off',
      [TEXT]: value,
    }));
}

function cardElement(
  card: IVaultCard,
  id: number,
  labelIds: ReadonlyMap<TGroupId, number>,
  groupIds: readonly TGroupId[]
): TElement {
  const fields = allFields(card);
  const notes = fields.find(field => field.spec.kind === 'note' && valuesInUse(field).length > 0);
  const symbol = SYMBOLS[card.templateId];
  return {
    ...(isNil(symbol) ? {} : { [`${ATTRIBUTE}symbol`]: symbol }),
    [`${ATTRIBUTE}color`]: isNil(card.color) ? NO_COLOR : COLORS[card.color],
    [`${ATTRIBUTE}template`]: 'false',
    [`${ATTRIBUTE}star`]: String(card.favorite),
    [`${ATTRIBUTE}deleted`]: 'false',
    [`${ATTRIBUTE}type`]: 'card',
    [`${ATTRIBUTE}title`]: card.title,
    [`${ATTRIBUTE}autofill`]: 'on',
    [`${ATTRIBUTE}id`]: String(id),
    [`${ATTRIBUTE}first_stamp`]: String(card.createdAt.wallMs),
    [`${ATTRIBUTE}time_stamp`]: String(card.updatedAt.wallMs),
    field: fields.filter(field => field !== notes).flatMap(fieldElements),
    ...(isNil(notes) ? {} : { notes: valuesInUse(notes).join('\n') }),
    label_id: groupIds.flatMap(groupId => {
      const labelId = labelIds.get(groupId);
      return isNil(labelId) ? [] : [String(labelId)];
    }),
  };
}

/**
 * Every card outside the trash as SafeInCloud's XML, shaped as the app writes it inside its own
 * database (card marks, stamps, autofill hints), so the same text serves "Import → SafeInCloud
 * XML" and a sealed `.db`: fields in their order under their names, the first note as the card's notes, groups as
 * labels, the star and the colour. SafeInCloud has no tabs, archive or protection: the fields of
 * every tab follow one another, archived cards come along as they are. Files are left out.
 */
export function exportSafeInCloud(document: IVaultDocument): string {
  const groups = [...document.groups.values()].sort((first, second) => first.order - second.order);
  const labelIds = new Map(groups.map((group, index) => [group.id, index + 1]));
  const cards = [...document.cards.values()].filter(card => isNil(card.trashedAt));
  const xml: unknown = builder.build({
    database: {
      label: groups.map(group => ({
        [`${ATTRIBUTE}name`]: group.name,
        [`${ATTRIBUTE}id`]: String(labelIds.get(group.id)),
      })),
      card: cards.map((card, index) =>
        cardElement(
          card,
          groups.length + index + 1,
          labelIds,
          liveGroupIds(document, card.groupIds)
        )
      ),
    },
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${String(xml)}`;
}
