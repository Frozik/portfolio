import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import type { IHlc } from './hlc';
import { compareHlc } from './hlc';
import type { TCardId, TLinkId } from './ids';
import type { ICardLink, IVaultDocument, TTombstoneKey } from './vault-document';

export type TLinkError = { readonly kind: 'self-link' } | { readonly kind: 'card-missing' };

/** The pair in a fixed order, so every device derives the same id without a round trip. */
export function linkIdOf(first: TCardId, second: TCardId): TLinkId {
  return (first < second ? `${first}:${second}` : `${second}:${first}`) as TLinkId;
}

function linkTombstone(id: TLinkId): TTombstoneKey {
  return `link:${id}`;
}

/**
 * A link is alive when it is newer than any tombstone of its id,
 * or when it was purged together with a card (the same stamp) that has come
 * back since: an edit newer than the deletion restores the card with its links.
 */
export function isLinkAlive(document: IVaultDocument, link: ICardLink): boolean {
  const tombstone = document.tombstones.get(linkTombstone(link.id));
  if (isNil(tombstone) || compareHlc(link.createdAt, tombstone) > 0) {
    return true;
  }
  return [link.a, link.b].some(cardId => {
    const cardTombstone = document.tombstones.get(`card:${cardId}`);
    return (
      document.cards.has(cardId) &&
      !isNil(cardTombstone) &&
      compareHlc(cardTombstone, tombstone) === 0
    );
  });
}

/** */
export function linkCards(
  document: IVaultDocument,
  first: TCardId,
  second: TCardId,
  at: IHlc
): TResult<IVaultDocument, TLinkError> {
  if (first === second) {
    return err({ kind: 'self-link' });
  }
  if (!document.cards.has(first) || !document.cards.has(second)) {
    return err({ kind: 'card-missing' });
  }
  const id = linkIdOf(first, second);
  const existing = document.links.get(id);
  if (!isNil(existing) && isLinkAlive(document, existing)) {
    return ok(document);
  }
  const [a, b] = first < second ? [first, second] : [second, first];
  return ok({ ...document, links: new Map(document.links).set(id, { id, a, b, createdAt: at }) });
}

export function unlinkCards(document: IVaultDocument, linkId: TLinkId, at: IHlc): IVaultDocument {
  if (!document.links.has(linkId)) {
    return document;
  }
  const links = new Map(document.links);
  links.delete(linkId);
  return {
    ...document,
    links,
    tombstones: new Map(document.tombstones).set(linkTombstone(linkId), at),
  };
}

/** Links to cards that are gone or in the trash are hidden, not removed. */
export function linkedCardIds(document: IVaultDocument, cardId: TCardId): readonly TCardId[] {
  const neighbours: TCardId[] = [];
  for (const link of document.links.values()) {
    if (link.a !== cardId && link.b !== cardId) {
      continue;
    }
    const card = document.cards.get(link.a === cardId ? link.b : link.a);
    if (!isNil(card) && isNil(card.trashedAt) && isLinkAlive(document, link)) {
      neighbours.push(card.id);
    }
  }
  return neighbours;
}
