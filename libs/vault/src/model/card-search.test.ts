import { aCardWith, aField } from '../testing/builders';
import { searchCards } from './card-search';
import { inOtherLayout } from './keyboard-layout';

const urls = { kind: 'url', match: 'host', useSharedCredentials: true } as const;

const sber = aCardWith([aField(urls, ['https://online.sberbank.ru'])], { title: 'Sberbank' });
const societe = aCardWith([aField({ kind: 'login' }, 'jean.dupont')], {
  title: 'Société Générale',
});
const yolka = aCardWith([], { title: 'Ёлка подарки' });
const github = aCardWith(
  [
    aField(urls, ['https://github.com/login']),
    aField({ kind: 'password', rotateEveryDays: null }, 'hunter2', { sensitive: true }),
  ],
  { title: 'Work code' }
);
const megaSber = aCardWith([], { title: 'My Sberbank business' });
const cards = [megaSber, sber, societe, yolka, github];

const titles = (query: string): readonly string[] =>
  searchCards(cards, query).map(card => card.title);

describe('searching cards', () => {
  it('returns every card for an empty query, in the given order', () => {
    expect(searchCards(cards, '   ')).toBe(cards);
  });

  it('ranks a title start above a word start above a mere substring', () => {
    expect(titles('sber')).toEqual(['Sberbank', 'My Sberbank business']);
    expect(titles('erban')).toEqual(['My Sberbank business', 'Sberbank']);
  });

  it('ignores case, ё and diacritics', () => {
    expect(titles('SOCIETE generale')).toEqual(['Société Générale']);
    expect(titles('елка')).toEqual(['Ёлка подарки']);
  });

  it('finds a query typed in the other keyboard layout, both ways', () => {
    expect(inOtherLayout('ыиук')).toBe('sber');
    expect(titles('ыиук')).toEqual(['Sberbank', 'My Sberbank business']);
    expect(titles(inOtherLayout('подарки'))).toEqual(['Ёлка подарки']);
  });

  it('finds a card by the host and domain of its addresses and by visible fields', () => {
    expect(titles('github')).toEqual(['Work code']);
    expect(titles('online.sber')).toEqual(['Sberbank']);
    expect(titles('dupont')).toEqual(['Société Générale']);
  });

  it('never finds a card by a secret', () => {
    expect(titles('hunter2')).toEqual([]);
  });

  it('requires every word of the query', () => {
    expect(titles('sber business')).toEqual(['My Sberbank business']);
    expect(titles('sber github')).toEqual([]);
  });
});
