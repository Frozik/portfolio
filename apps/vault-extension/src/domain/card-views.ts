import type { IVaultCard, TFieldKind } from '@frozik/vault/model/card';
import { allFields, fieldValues } from '@frozik/vault/model/card';
import type { TCardId, TFieldId } from '@frozik/vault/model/ids';
import { isNil } from 'lodash-es';

/** What the popup lists: never a secret. */
export interface ICardSummary {
  readonly id: TCardId;
  readonly title: string;
  readonly login: string | null;
  readonly shared: boolean;
  readonly protected: boolean;
}

/** A field as the popup shows it: a secret's value comes only on "show" or never (copy goes through the worker). */
export interface IFieldView {
  readonly id: TFieldId;
  readonly label: string;
  readonly kind: TFieldKind | 'unknown';
  readonly sensitive: boolean;
  readonly value: string | null;
}

export interface ICardView {
  readonly id: TCardId;
  readonly title: string;
  /** Its secrets need the master password again. */
  readonly protected: boolean;
  readonly fields: readonly IFieldView[];
}

const LOGIN_KINDS: ReadonlySet<string> = new Set(['login', 'email']);

function loginOf(card: IVaultCard): string | null {
  const field = allFields(card).find(candidate => LOGIN_KINDS.has(candidate.spec.kind));
  return isNil(field) ? null : (fieldValues(field)[0] ?? null);
}

export function summaryOf(card: IVaultCard, shared: boolean): ICardSummary {
  return {
    id: card.id,
    title: card.title,
    login: loginOf(card),
    shared,
    protected: card.protected,
  };
}

/** The card's fields with their values, secrets left out until asked for one by one. */
export function viewOf(card: IVaultCard): ICardView {
  return {
    id: card.id,
    title: card.title,
    protected: card.protected,
    fields: allFields(card)
      .filter(field => fieldValues(field).length > 0)
      .map(field => ({
        id: field.id,
        label: field.label,
        kind: field.spec.kind,
        sensitive: field.sensitive,
        value: field.sensitive ? null : fieldValues(field).join('\n'),
      })),
  };
}
