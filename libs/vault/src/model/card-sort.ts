import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import type { ICardState } from './card';
import { compareStrings } from './compare-strings';
import { expiresOn } from './expiry';
import { compareHlc } from './hlc';

/** "recently used" joins once the device's usage store is read (it is not synchronised). */
export type TCardSort = 'title' | 'updated' | 'created' | 'expiry';

export const CARD_SORTS: readonly TCardSort[] = ['title', 'updated', 'created', 'expiry'];

function byExpiry(first: ICardState, second: ICardState): number {
  const firstDate = expiresOn(first);
  const secondDate = expiresOn(second);
  if (isNil(firstDate) || isNil(secondDate)) {
    return Number(isNil(firstDate)) - Number(isNil(secondDate));
  }
  return Temporal.PlainDate.compare(firstDate, secondDate);
}

function comparatorOf(sort: TCardSort): (first: ICardState, second: ICardState) => number {
  switch (sort) {
    case 'title':
      return (first, second) => compareStrings(first.title, second.title);
    case 'updated':
      return (first, second) => compareHlc(second.updatedAt, first.updatedAt);
    case 'created':
      return (first, second) => compareHlc(second.createdAt, first.createdAt);
    case 'expiry':
      return byExpiry;
    default:
      return assertNever(sort);
  }
}

/**
 * Title A→Z, newest change or creation first, or the soonest
 * expiry first with cards that never expire last; ties fall back to the
 * title. Favourites go on top when the user asks for it.
 */
export function sortCards<Card extends ICardState>(
  cards: readonly Card[],
  sort: TCardSort,
  { favoritesFirst }: { readonly favoritesFirst: boolean }
): readonly Card[] {
  const primary = comparatorOf(sort);
  const byTitle = comparatorOf('title');
  return [...cards].sort(
    (first, second) =>
      (favoritesFirst ? Number(second.favorite) - Number(first.favorite) : 0) ||
      primary(first, second) ||
      byTitle(first, second)
  );
}
