import { isNil } from 'lodash-es';

import type { ICardState, IVaultCard } from '../model/card';
import { allFields, valuesInUse } from '../model/card';
import type { IVaultDocument } from '../model/vault-document';

/** The cards the audit looks at: neither archived nor in the trash. */
export function auditedCards(document: IVaultDocument): readonly IVaultCard[] {
  return [...document.cards.values()].filter(
    card => isNil(card.archivedAt) && isNil(card.trashedAt)
  );
}

/** A card's values of one kind the audit weighs: fields the user excluded stay out. */
export function auditedValuesOf(card: ICardState, kind: 'password' | 'url'): readonly string[] {
  return allFields(card)
    .filter(field => field.spec.kind === kind && !field.excludeFromAudit)
    .flatMap(valuesInUse);
}

export function passwordsOf(card: ICardState): readonly string[] {
  return auditedValuesOf(card, 'password');
}

/** Every distinct password the audit needs a strength or a breach count for. */
export function auditedPasswords(document: IVaultDocument): readonly string[] {
  return [...new Set(auditedCards(document).flatMap(passwordsOf))];
}
