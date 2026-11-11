import { unzlibSync } from 'fflate';
import { isNil } from 'lodash-es';

import type { TBytes } from '../../crypto/bytes';
import { fromBase64 } from '../../crypto/bytes';
import type { TAssetId } from '../../model/ids';

import { sha256Hex } from '../../crypto/sha256';
import type { TCardColor, TFieldKind } from '../../model/card';
import { detectCardNetwork } from '../../model/card-network';
import { parsePlainDate } from '../../model/field-kinds/plain-date';
import { parseYearMonth } from '../../model/field-kinds/year-month';
import { BANK_CARD_TEMPLATE } from '../../model/templates/bank-card';
import { BLANK_TEMPLATE } from '../../model/templates/blank';
import { INTERNET_ACCOUNT_TEMPLATE } from '../../model/templates/internet-account';
import { NOTE_TEMPLATE } from '../../model/templates/note';
import type { ICardTemplate } from '../../model/templates/template';
import { hasValidLuhnChecksum } from '../../model/validation/luhn';
import { mimeOfFileName } from '../attachment';
import type {
  IImportBatch,
  IImportedAsset,
  IImportedCard,
  IImportedField,
  TImportWarning,
} from '../imported-card';
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

const NUMBER_SEPARATORS = /[\s-]/g;
/** A text field holding nothing but a web address: a site typed into a template the user made. */
const WEB_ADDRESS = /^https?:\/\/\S+$/i;
/** The types a card's number is typed into: SafeInCloud's own, or a text field of a template the user made. */
const NUMBER_TYPES: ReadonlySet<string> = new Set(['number', 'text']);

/** Any card number's length, whichever network issued it (ISO/IEC 7812). */
const CARD_NUMBER_LENGTH = /^\d{13,19}$/;

/**
 * A bank card's number, not a passport's, a tax number or an account: of a known network, its
 * length and (where the network uses one) its check digit right; of a network no list names — a
 * national one — only on a card that is plainly a bank card, with its Luhn digit right.
 */
function isCardNumber(value: string, onBankCard: boolean): boolean {
  const digits = value.replace(NUMBER_SEPARATORS, '');
  const network = detectCardNetwork(digits);
  if (isNil(network)) {
    return onBankCard && CARD_NUMBER_LENGTH.test(digits) && hasValidLuhnChecksum(digits);
  }
  return (
    network.lengths.includes(digits.length) && (!network.checksLuhn || hasValidLuhnChecksum(digits))
  );
}

/** A month to expire (not a document's full day) or a PIN: a bank card, whatever its network. */
function isBankCard(card: TSafeInCloudCard): boolean {
  return (card.field ?? []).some(
    ({ type, text }) =>
      type === 'pin' ||
      (type === 'expiry' && isNil(parsePlainDate(text ?? '')) && !isNil(parseYearMonth(text ?? '')))
  );
}

/**
 * SafeInCloud's types say less than the values: a card's number may sit in any number or text
 * field, so it is told by its value (and shows its network), as is a site's address in a text
 * field (and its icon); its "expiry" is whatever was typed, so a full day stays a day, as a
 * document's does, and the rest is a card's month.
 */
function kindOf(type: string | undefined, value: string, onBankCard: boolean): TFieldKind {
  const kind = FIELD_KINDS.get(type ?? '') ?? 'text';
  if (NUMBER_TYPES.has(type ?? 'text') && isCardNumber(value, onBankCard)) {
    return 'card-number';
  }
  if (kind === 'text' && WEB_ADDRESS.test(value.trim())) {
    return 'url';
  }
  return kind === 'expiry-month' && !isNil(parsePlainDate(value)) ? 'expiry-date' : kind;
}

/** Each field's kind, in the card's order. */
function kindsOf(card: TSafeInCloudCard): readonly TFieldKind[] {
  const onBankCard = isBankCard(card);
  return (card.field ?? []).map(field => kindOf(field.type, field.text ?? '', onBankCard));
}

/** SafeInCloud keeps no template per card: the kinds of its fields tell which list icon and subtitle suit it. */
function templateOf(kinds: ReadonlySet<TFieldKind>): ICardTemplate {
  if (kinds.has('url') || kinds.has('login')) {
    return INTERNET_ACCOUNT_TEMPLATE;
  }
  if (kinds.has('card-number') || (kinds.has('expiry-month') && kinds.has('pin'))) {
    return BANK_CARD_TEMPLATE;
  }
  return kinds.size === 0 ? NOTE_TEMPLATE : BLANK_TEMPLATE;
}

function fieldsOf(card: TSafeInCloudCard, kinds: readonly TFieldKind[]): readonly IImportedField[] {
  const fields = (card.field ?? []).map((field, index) => {
    const kind = kinds[index] ?? 'text';
    const value = field.text ?? '';
    return extraField(kind, textLabel(field.name ?? ''), kind === 'url' ? [value] : value);
  });
  const notes = textOf(card.notes);
  return notes === '' ? fields : [...fields, extraField('note', keyLabel('field.notes'), notes)];
}

function inflated(bytes: TBytes): Uint8Array<ArrayBuffer> | null {
  try {
    return new Uint8Array(unzlibSync(bytes));
  } catch {
    return null;
  }
}

/** Files come zlib'd, pictures as they are; one that does not decode is reported and left behind. */
function attachmentsOf(card: TSafeInCloudCard): readonly IAttachment[] {
  const files = (card.file ?? []).map(file => {
    const name = file.name ?? '';
    const packed = fromBase64(file.text ?? '');
    return { name, bytes: isNil(packed) ? null : inflated(packed) };
  });
  const images = (card.image ?? []).map((image, index) => ({
    name: `image${index + 1}.jpg`,
    bytes: fromBase64(textOf(image)),
  }));
  return [...files, ...images];
}

interface IAttachment {
  readonly name: string;
  readonly bytes: Uint8Array<ArrayBuffer> | null;
}

async function cardOf(
  card: TSafeInCloudCard,
  position: number,
  labels: ReadonlyMap<string, string>,
  run: { readonly warnings: TImportWarning[]; readonly assets: IImportedAsset[] }
): Promise<IImportedCard> {
  const title = card.title ?? '';
  const files: string[] = [];
  for (const [index, { name, bytes }] of attachmentsOf(card).entries()) {
    if (isNil(bytes)) {
      run.warnings.push({ kind: 'file-dropped', card: title, name });
      continue;
    }
    const id = `safeincloud/${position}/${index}`;
    run.assets.push({
      asset: {
        id: id as TAssetId,
        name,
        mime: mimeOfFileName(name),
        sha256: await sha256Hex(bytes),
      },
      bytes,
    });
    files.push(id);
  }
  const kinds = kindsOf(card);
  const fields = [
    ...fieldsOf(card, kinds),
    ...(files.length === 0 ? [] : [extraField('file', keyLabel('field.files'), files)]),
  ];
  return plainCard(templateOf(new Set(kinds)), title, [{ title: null, fields }], {
    groups: (card.label_id ?? []).flatMap(id => {
      const name = labels.get(textOf(id));
      return isNil(name) ? [] : [name];
    }),
    favorite: card.star === TRUE,
    color: COLORS.get(card.color ?? '') ?? null,
  });
}

/**
 * SafeInCloud: each card with its fields in their order and under their names, its files and
 * pictures as the card's files, labels as groups, the star and the colour; templates and deleted
 * cards stay behind, and an attachment that does not decode is reported.
 */
export async function importSafeInCloud(database: TSafeInCloudDatabase): Promise<IImportBatch> {
  const labels = new Map((database.label ?? []).map(({ id, name }) => [id, name]));
  const run = { warnings: [] as TImportWarning[], assets: [] as IImportedAsset[] };
  const kept = (database.card ?? []).filter(
    card => card.template !== TRUE && card.deleted !== TRUE
  );
  const cards: IImportedCard[] = [];
  for (const [position, card] of kept.entries()) {
    cards.push(await cardOf(card, position, labels, run));
  }
  return { source: 'safeincloud', cards, links: [], assets: run.assets, warnings: run.warnings };
}
