import { allFields, fieldValues } from '@frozik/vault/model/card';
import type { IVaultCard } from '@frozik/vault/model/card';
import type { TUrlMatchResult } from '@frozik/vault/model/url-match';
import { matchUrl } from '@frozik/vault/model/url-match';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import { isNil } from 'lodash-es';

export interface ISiteCard {
  readonly card: IVaultCard;
  /** A shared login (apple.com ↔ icloud.com) is offered with a note. */
  readonly match: Exclude<TUrlMatchResult, null>;
}

function bestMatch(card: IVaultCard, pageUrl: string): TUrlMatchResult {
  let best: TUrlMatchResult = null;
  for (const field of allFields(card)) {
    if (field.spec.kind !== 'url') {
      continue;
    }
    for (const stored of fieldValues(field)) {
      const result = matchUrl(stored, field.spec, pageUrl);
      if (result === 'direct') {
        return result;
      }
      best = best ?? result;
    }
  }
  return best;
}

/**
 * The cards for the page: by each address field's own
 * rule (`host` unless it says otherwise), direct matches first; archived and
 * trashed cards are never offered.
 */
export function cardsForPage(document: IVaultDocument, pageUrl: string): readonly ISiteCard[] {
  const found: ISiteCard[] = [];
  for (const card of document.cards.values()) {
    if (!isNil(card.archivedAt) || !isNil(card.trashedAt)) {
      continue;
    }
    const match = bestMatch(card, pageUrl);
    if (!isNil(match)) {
      found.push({ card, match });
    }
  }
  return found.sort(
    (first, second) =>
      Number(first.match === 'shared') - Number(second.match === 'shared') ||
      first.card.title.localeCompare(second.card.title)
  );
}

/** The fill script compares its own frame against this before it types anything. */
export function cardServesPage(card: IVaultCard, pageUrl: string): boolean {
  return !isNil(bestMatch(card, pageUrl));
}
