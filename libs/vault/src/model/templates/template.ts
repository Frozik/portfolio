import type { TNonEmptyArray } from '@frozik/utils/types/base';

import type { TBuiltinIcon } from '../builtin-icons';
import type { TFieldKind, TFieldSpec } from '../card';
import type { TTemplateId } from '../ids';
import { DEFAULT_EXPIRY_WARNING_DAYS } from '../vault-document';

/** A field a template puts on a new card; the label is a translation key the client resolves. */
export interface ITemplateField {
  readonly kind: TFieldKind;
  readonly labelKey: string;
  readonly cardinality: 'single' | 'list';
  /** Overrides the kind's default spec: the scheme of a bank code, the options of a select as translation keys. */
  readonly spec?: TFieldSpec;
  /** Overrides the kind's default: a user template keeps what its card had. */
  readonly sensitive?: boolean;
}

export interface ITemplateTab {
  readonly titleKey: string | null;
  readonly fields: readonly ITemplateField[];
}

/** A starting point: a card copies its fields once and is independent afterwards. */
export interface ICardTemplate {
  readonly id: TTemplateId;
  readonly nameKey: string;
  readonly icon: TBuiltinIcon;
  readonly tabs: TNonEmptyArray<ITemplateTab>;
  /** What the list shows under the title: the login of an account, `•••• 1234` of a card. */
  readonly subtitleFieldKind: TFieldKind | null;
  /** Days before expiry the card counts as expiring soon, unless the vault settings say otherwise. */
  readonly expiryWarningDays: number;
}

type TTemplateDefinition = Omit<ICardTemplate, 'id' | 'expiryWarningDays'> & {
  readonly id: string;
  readonly expiryWarningDays?: number;
};

export function defineTemplate(definition: TTemplateDefinition): ICardTemplate {
  return {
    ...definition,
    id: definition.id as TTemplateId,
    expiryWarningDays: definition.expiryWarningDays ?? DEFAULT_EXPIRY_WARNING_DAYS,
  };
}

export function single(kind: TFieldKind, labelKey: string, spec?: TFieldSpec): ITemplateField {
  return { kind, labelKey, cardinality: 'single', spec };
}

export function list(kind: TFieldKind, labelKey: string, spec?: TFieldSpec): ITemplateField {
  return { kind, labelKey, cardinality: 'list', spec };
}

export const NOTES = single('note', 'field.notes');
