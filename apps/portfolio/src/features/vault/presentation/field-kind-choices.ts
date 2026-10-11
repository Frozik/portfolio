import type { TFieldKind } from '@frozik/vault/model/card';

/** The kinds a person picks from: a field to add, a field a smart group looks for. */
export const FIELD_KIND_CHOICES: readonly TFieldKind[] = [
  'text',
  'login',
  'password',
  'email',
  'url',
  'phone',
  'otp',
  'note',
  'multiline',
  'secret',
  'pin',
  'card-number',
  'cvv',
  'expiry-month',
  'expiry-date',
  'date',
  'iban',
  'bic',
  'bank-account',
  'bank-code',
  'security-question',
  'select',
  'boolean',
  'file',
];

/** A new field of these kinds holds a list from the start: several files under one label. */
export const LIST_BY_DEFAULT: ReadonlySet<TFieldKind> = new Set<TFieldKind>(['file']);
