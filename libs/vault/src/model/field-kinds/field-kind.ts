import { isNil } from 'lodash-es';

import type { ICardState, TFieldKind, TFieldSpec, TSimpleFieldKind } from '../card';

export type TSpecOf<Kind extends TFieldKind> = Kind extends TSimpleFieldKind
  ? { readonly kind: Kind }
  : Extract<TFieldSpec, { readonly kind: Kind }>;

export type TValidationCode =
  | 'email-format'
  | 'url-format'
  | 'digits-only'
  | 'luhn'
  | 'card-length'
  | 'cvv-length'
  | 'month-format'
  | 'date-format'
  | 'boolean-format'
  | 'iban-checksum'
  | 'bic-format'
  | 'bank-code-format'
  | 'bank-account-format'
  | 'bank-account-key'
  | 'otp-format'
  | 'not-an-option';

/** A warning is shown and saved anyway (a failed checksum); an invalid value is not saved. */
export type TValidation =
  | { readonly kind: 'valid' }
  | { readonly kind: 'warning'; readonly code: TValidationCode }
  | { readonly kind: 'invalid'; readonly code: TValidationCode };

export const VALID: TValidation = { kind: 'valid' };

export function warning(code: TValidationCode): TValidation {
  return { kind: 'warning', code };
}

export function invalid(code: TValidationCode): TValidation {
  return { kind: 'invalid', code };
}

/** What a kind sees of its surroundings: cross-field checks (account ↔ BIC) read the whole card. */
export interface IFieldContext<Spec extends TFieldSpec = TFieldSpec> {
  readonly spec: Spec;
  readonly card: ICardState;
}

/** One row of the registry as it is written: closed over its own kind and spec. */
export interface IFieldKindDefinition<Kind extends TFieldKind> {
  readonly kind: Kind;
  readonly sensitiveByDefault: boolean;
  readonly listAllowed: boolean;
  /** Whether non-sensitive values of this kind enter the search index. */
  readonly searchable: boolean;
  readonly defaultSpec: TSpecOf<Kind>;
  readonly normalize?: (value: string, context: IFieldContext<TSpecOf<Kind>>) => string;
  readonly validate?: (value: string, context: IFieldContext<TSpecOf<Kind>>) => TValidation;
  /** Locale-free display form (IBAN in fours, the card number in its network's groups). */
  readonly format?: (value: string, spec: TSpecOf<Kind>) => string;
  /** What the clipboard gets: an IBAN without spaces, a card number of digits. */
  readonly copyValue?: (value: string) => string;
}

/** The uniform face every row shows the rest of the core (object-kind registries). */
export interface IFieldKind {
  readonly kind: TFieldKind;
  readonly sensitiveByDefault: boolean;
  readonly listAllowed: boolean;
  readonly searchable: boolean;
  readonly defaultSpec: TFieldSpec;
  normalize(value: string, context: IFieldContext): string;
  validate(value: string, context: IFieldContext): TValidation;
  format(value: string, spec: TFieldSpec): string;
  copyValue(value: string): string;
}

function isSpecOf<Kind extends TFieldKind>(spec: TFieldSpec, kind: Kind): spec is TSpecOf<Kind> {
  return spec.kind === kind;
}

const identity = (value: string): string => value;

export function defineFieldKind<Kind extends TFieldKind>(
  definition: IFieldKindDefinition<Kind>
): IFieldKind {
  const { kind, normalize, validate } = definition;
  return {
    kind,
    sensitiveByDefault: definition.sensitiveByDefault,
    listAllowed: definition.listAllowed,
    searchable: definition.searchable,
    defaultSpec: definition.defaultSpec,
    normalize: (value, { spec, card }) =>
      isSpecOf(spec, kind) && !isNil(normalize) ? normalize(value, { spec, card }) : value,
    validate: (value, { spec, card }) => {
      if (value === '' || !isSpecOf(spec, kind) || isNil(validate)) {
        return VALID;
      }
      return validate(value, { spec, card });
    },
    format: (value, spec) =>
      isSpecOf(spec, kind) && !isNil(definition.format) ? definition.format(value, spec) : value,
    copyValue: definition.copyValue ?? identity,
  };
}
