import type { IHlc } from './hlc';
import type { TCardId } from './ids';
import type { IVaultDocument, TTombstoneKey } from './vault-document';

/**
 * Gone for good: a tombstone for the card and, under the same
 * stamp, for every link it had, so a concurrent edit newer than the stamp
 * brings back the card with exactly those links.
 */
export function purgeCard(document: IVaultDocument, cardId: TCardId, at: IHlc): IVaultDocument {
  if (!document.cards.has(cardId)) {
    return document;
  }
  const cards = new Map(document.cards);
  cards.delete(cardId);
  const links = new Map(document.links);
  const tombstones = new Map(document.tombstones).set(`card:${cardId}` satisfies TTombstoneKey, at);
  for (const link of document.links.values()) {
    if (link.a === cardId || link.b === cardId) {
      links.delete(link.id);
      tombstones.set(`link:${link.id}`, at);
    }
  }
  return { ...document, cards, links, tombstones };
}
