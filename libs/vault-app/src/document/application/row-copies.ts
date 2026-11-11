import type { ICardField, ICardState, TFieldKind } from '@frozik/vault/model/card';
import { allFields, valuesInUse } from '@frozik/vault/model/card';
import { isNil } from 'lodash-es';

/** What a copy is to the person: the row draws each with its own mark. */
export type TRowCopyRole =
  | 'login'
  | 'email'
  | 'password'
  | 'one-time-code'
  | 'card-number'
  | 'holder'
  | 'expiry'
  | 'pin'
  | 'iban'
  | 'bic'
  | 'account-number'
  | 'bank-code'
  | 'document-number'
  | 'host'
  | 'network'
  | 'note';

export interface IRowCopy {
  readonly role: TRowCopyRole;
  /** The field's own name: what the snackbar says was copied. */
  readonly label: string;
  /** The value; of a one-time code, its `otpauth://` URI — the code itself is made at the copy. */
  readonly text: string;
}

/**
 * A field to copy by its kind and its place among the card's fields of that kind: a card keeps no
 * link to the template field it came from, and a name can be changed, so the kind and the order
 * are what stay (the holder of a bank account is its second text, after the bank).
 */
interface ICopySource {
  readonly role: TRowCopyRole;
  readonly kind: TFieldKind;
  readonly nth?: number;
  /** Taken when the card has no field of `kind`: the email standing in for a login. */
  readonly orKind?: TFieldKind;
}

const ACCOUNT: readonly ICopySource[] = [
  { role: 'login', kind: 'login', orKind: 'email' },
  { role: 'password', kind: 'password' },
  { role: 'one-time-code', kind: 'otp' },
];

const HOLDER: ICopySource = { role: 'holder', kind: 'text', nth: 2 };

/** What matters to paste elsewhere, per template, at most four: everything else opens the card. */
const SOURCES_BY_TEMPLATE: Readonly<Record<string, readonly ICopySource[]>> = {
  'internet-account': ACCOUNT,
  'email-account': [
    { role: 'email', kind: 'email' },
    { role: 'password', kind: 'password' },
    { role: 'one-time-code', kind: 'otp' },
  ],
  'bank-card': [
    { role: 'card-number', kind: 'card-number' },
    { role: 'holder', kind: 'text' },
    { role: 'expiry', kind: 'expiry-month' },
    { role: 'pin', kind: 'pin' },
  ],
  'bank-account': [
    { role: 'iban', kind: 'iban' },
    { role: 'bic', kind: 'bic' },
    HOLDER,
    { role: 'account-number', kind: 'bank-account' },
  ],
  'bank-account-uk': [
    { role: 'account-number', kind: 'bank-account' },
    { role: 'bank-code', kind: 'bank-code' },
    HOLDER,
    { role: 'iban', kind: 'iban' },
  ],
  'bank-account-us': [
    { role: 'account-number', kind: 'bank-account' },
    { role: 'bank-code', kind: 'bank-code' },
    HOLDER,
  ],
  'bank-account-ru': [
    { role: 'account-number', kind: 'bank-account' },
    { role: 'bank-code', kind: 'bank-code' },
    HOLDER,
  ],
  document: [
    { role: 'document-number', kind: 'secret' },
    { role: 'expiry', kind: 'expiry-date' },
  ],
  server: [
    { role: 'host', kind: 'url' },
    { role: 'login', kind: 'login' },
    { role: 'password', kind: 'password' },
  ],
  wifi: [
    { role: 'network', kind: 'text' },
    { role: 'password', kind: 'password' },
  ],
  note: [{ role: 'note', kind: 'note' }],
};

function nthOf(card: ICardState, kind: TFieldKind, nth: number): ICardField | undefined {
  return allFields(card).filter(field => field.spec.kind === kind)[nth - 1];
}

function copyOf(card: ICardState, source: ICopySource): IRowCopy | null {
  const field =
    nthOf(card, source.kind, source.nth ?? 1) ??
    (isNil(source.orKind) ? undefined : nthOf(card, source.orKind, 1));
  if (isNil(field) || (source.kind === 'otp' && field.value.cardinality !== 'single')) {
    return null;
  }
  const [text] = valuesInUse(field);
  return isNil(text) || text === '' ? null : { role: source.role, label: field.label, text };
}

/**
 * What a row offers to copy without opening its card, chosen by the card's template: an
 * account's login, password and one-time code, a bank card's number, holder, expiry and PIN, and
 * so on. A card from a template of the user's or the blank one is offered what an account is.
 */
export function rowCopiesOf(card: ICardState): readonly IRowCopy[] {
  const sources = SOURCES_BY_TEMPLATE[card.templateId] ?? ACCOUNT;
  return sources.flatMap(source => {
    const copy = copyOf(card, source);
    return isNil(copy) ? [] : [copy];
  });
}
