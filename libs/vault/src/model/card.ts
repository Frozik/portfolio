import type { TNonEmptyArray } from '@frozik/utils/types/base';

import type { TBuiltinIcon } from './builtin-icons';
import type { IHlc } from './hlc';
import type { TAssetId, TCardId, TFieldId, TGroupId, TTabId, TTemplateId } from './ids';

/** Kinds whose behaviour is fixed by the kind alone. */
export type TSimpleFieldKind =
  | 'text'
  | 'login'
  | 'email'
  | 'phone'
  | 'secret'
  | 'pin'
  | 'otp'
  | 'card-number'
  | 'cvv'
  | 'expiry-month'
  | 'expiry-date'
  | 'date'
  | 'boolean'
  | 'iban'
  | 'bic'
  | 'bank-account'
  | 'file'
  | 'multiline'
  | 'note';

/** National bank codes beside the international SWIFT/BIC and IBAN. */
export type TBankCodeScheme =
  | 'national'
  | 'aba-routing'
  | 'ca-routing'
  | 'sort-code'
  | 'bsb'
  | 'ifsc'
  | 'ru-bic';

export type TUrlMatch = 'host' | 'base-domain' | 'exact' | 'starts-with' | 'regex' | 'never';

/** The kind of a field and the parameters only some kinds carry. */
export type TFieldSpec =
  | { readonly kind: TSimpleFieldKind }
  /** A period the password is to be changed in, `null` for none. */
  | { readonly kind: 'password'; readonly rotateEveryDays: number | null }
  | { readonly kind: 'select'; readonly options: readonly string[]; readonly allowCustom: boolean }
  | { readonly kind: 'security-question'; readonly question: string }
  | { readonly kind: 'bank-code'; readonly scheme: TBankCodeScheme }
  | { readonly kind: 'url'; readonly match: TUrlMatch; readonly useSharedCredentials: boolean }
  /** A kind from a newer version: shown read-only and written back untouched. */
  | { readonly kind: 'unknown'; readonly raw: unknown };

export type TFieldKind = Exclude<TFieldSpec['kind'], 'unknown'>;

export type TFieldValue =
  | { readonly cardinality: 'single'; readonly value: string }
  | { readonly cardinality: 'list'; readonly values: readonly string[] };

export interface ICardField {
  readonly id: TFieldId;
  readonly label: string;
  readonly spec: TFieldSpec;
  readonly value: TFieldValue;
  readonly sensitive: boolean;
  readonly excludeFromAudit: boolean;
}

/** One untitled tab by default; the tab bar appears from the second. */
export interface ICardTab {
  readonly id: TTabId;
  readonly title: string | null;
  readonly fields: readonly ICardField[];
}

/** A palette of tokens with a light and a dark value each. */
export type TCardColor =
  | 'red'
  | 'orange'
  | 'amber'
  | 'green'
  | 'teal'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'pink'
  | 'slate';

export type TCardIconRef =
  | { readonly kind: 'auto' }
  | { readonly kind: 'builtin'; readonly name: TBuiltinIcon }
  | { readonly kind: 'custom'; readonly assetId: TAssetId };

/** Everything of a card but its history. */
export interface ICardState {
  readonly id: TCardId;
  readonly title: string;
  readonly templateId: TTemplateId;
  readonly tabs: TNonEmptyArray<ICardTab>;
  readonly groupIds: readonly TGroupId[];
  readonly favorite: boolean;
  readonly color: TCardColor | null;
  readonly icon: TCardIconRef;
  readonly protected: boolean;
  readonly archivedAt: IHlc | null;
  readonly trashedAt: IHlc | null;
  readonly createdAt: IHlc;
  /** This version's id. */
  readonly updatedAt: IHlc;
  /**
   * Every version this one descends from, newest first, at most
   * MAX_CARD_ANCESTORS: an earlier version is an ancestor or a concurrent edit,
   * told apart by membership, whether or not it made it into history.
   */
  readonly ancestors: readonly IHlc[];
}

export interface ICardRevision {
  readonly at: IHlc;
  readonly snapshot: ICardState;
}

export interface IVaultCard extends ICardState {
  /** At most `MAX_CARD_HISTORY` snapshots, newest first. */
  readonly history: readonly ICardRevision[];
}

export const MAX_CARD_HISTORY = 20;

export const MAX_CARD_ANCESTORS = 32;

export function allFields(card: ICardState): readonly ICardField[] {
  return card.tabs.flatMap(tab => tab.fields);
}

/** A field's values as a list, empty ones left out: a single value is a list of one. */
export function fieldValues(field: ICardField): readonly string[] {
  const { value } = field;
  return (value.cardinality === 'single' ? [value.value] : value.values).filter(
    entry => entry !== ''
  );
}

/** A password field kept as a list: passwords used in turn, newest first — the one in use, then the one before it, down to the oldest. */
export function isPasswordRotation(field: ICardField): boolean {
  return field.spec.kind === 'password' && field.value.cardinality === 'list';
}

/** The values a field stands for now: of a password rotation, only the password in use. */
export function valuesInUse(field: ICardField): readonly string[] {
  const values = fieldValues(field);
  return isPasswordRotation(field) ? values.slice(0, 1) : values;
}

export interface IPasswordRotation {
  readonly current: string;
  readonly previous: string | null;
  readonly count: number;
}

/** A rotation as a person reads it: the password in use and the one it replaced; `null` for any other field. */
export function passwordRotationOf(field: ICardField): IPasswordRotation | null {
  const values = fieldValues(field);
  const [current] = values;
  if (!isPasswordRotation(field) || current === undefined) {
    return null;
  }
  return {
    current,
    previous: values[1] ?? null,
    count: values.length,
  };
}
