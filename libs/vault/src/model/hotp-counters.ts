import type { TCardId, TFieldId } from './ids';
import type { IVaultDocument, THotpCounterKey } from './vault-document';

export function hotpCounterKey(cardId: TCardId, fieldId: TFieldId): THotpCounterKey {
  return `${cardId}/${fieldId}`;
}

/**
 * The moving factor of a HOTP field: the larger of
 * the counter its URI started from and the highest one any device used.
 */
export function hotpCounterOf(
  document: IVaultDocument,
  cardId: TCardId,
  fieldId: TFieldId,
  initial: number
): number {
  return Math.max(initial, document.hotpCounters.get(hotpCounterKey(cardId, fieldId)) ?? initial);
}

/** A code was used: the next one is offered from now on, on every device after sync. */
export function advanceHotpCounter(
  document: IVaultDocument,
  cardId: TCardId,
  fieldId: TFieldId,
  initial: number
): IVaultDocument {
  const key = hotpCounterKey(cardId, fieldId);
  return {
    ...document,
    hotpCounters: new Map(document.hotpCounters).set(
      key,
      hotpCounterOf(document, cardId, fieldId, initial) + 1
    ),
  };
}
