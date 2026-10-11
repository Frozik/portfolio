import { aCard, aCardWith, aField, anHlc } from '../testing/builders';
import { sortCards } from './card-sort';

const titles = (cards: readonly { readonly title: string }[]): readonly string[] =>
  cards.map(card => card.title);

describe('sortCards', () => {
  it('sorts by title as people read it, ignoring case', () => {
    const cards = [aCard({ title: 'zoom' }), aCard({ title: 'Amazon' }), aCard({ title: 'bank' })];

    expect(titles(sortCards(cards, 'title', { favoritesFirst: false }))).toEqual([
      'Amazon',
      'bank',
      'zoom',
    ]);
  });

  it('puts the latest change first, and favourites on top when asked', () => {
    const cards = [
      aCard({ title: 'old', updatedAt: anHlc(1) }),
      aCard({ title: 'new', updatedAt: anHlc(9) }),
      aCard({ title: 'starred', updatedAt: anHlc(2), favorite: true }),
    ];

    expect(titles(sortCards(cards, 'updated', { favoritesFirst: false }))).toEqual([
      'new',
      'starred',
      'old',
    ]);
    expect(titles(sortCards(cards, 'updated', { favoritesFirst: true }))).toEqual([
      'starred',
      'new',
      'old',
    ]);
  });

  it('puts the soonest expiry first and cards that never expire last', () => {
    const cards = [
      aCard({ title: 'never' }),
      aCardWith([aField({ kind: 'expiry-date' }, '2027-01-01')], { title: 'later' }),
      aCardWith([aField({ kind: 'expiry-date' }, '2026-11-01')], { title: 'soon' }),
    ];

    expect(titles(sortCards(cards, 'expiry', { favoritesFirst: false }))).toEqual([
      'soon',
      'later',
      'never',
    ]);
  });
});
