import { isNil, uniq } from 'lodash-es';

import type { ICardState } from './card';
import { allFields } from './card';
import { loginHostOf, registrableDomainOf } from './domains';
import { FIELD_KINDS } from './field-kinds/registry';
import { inOtherLayout } from './keyboard-layout';

interface ISearchEntry {
  readonly title: string;
  readonly words: readonly string[];
  readonly text: string;
}

const Rank = { None: 0, Substring: 1, WordStart: 2, TitleStart: 3 } as const;

type TRank = (typeof Rank)[keyof typeof Rank];

const WORD_SEPARATORS = /[\s,.;:/@_()[\]{}"'«»-]+/u;
const COMBINING_MARKS = /\p{M}/gu;
const YO = /ё/g;
const TERM_SEPARATORS = /\s+/u;

/** Case, `ё` and diacritics do not matter: `Société` is found by `societe`. */
export function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(YO, 'е').normalize('NFD').replace(COMBINING_MARKS, '');
}

function searchableValues(card: ICardState): readonly string[] {
  const values: string[] = [];
  for (const field of allFields(card)) {
    if (
      field.sensitive ||
      field.spec.kind === 'unknown' ||
      !FIELD_KINDS[field.spec.kind].searchable
    ) {
      continue;
    }
    const entries = field.value.cardinality === 'single' ? [field.value.value] : field.value.values;
    values.push(...entries);
    if (field.spec.kind === 'url') {
      for (const url of entries) {
        const host = loginHostOf(url);
        values.push(...(isNil(host) ? [] : [host, registrableDomainOf(host) ?? host]));
      }
    }
  }
  return values;
}

const ENTRIES = new WeakMap<ICardState, ISearchEntry>();

function entryOf(card: ICardState): ISearchEntry {
  const cached = ENTRIES.get(card);
  if (!isNil(cached)) {
    return cached;
  }
  const title = normalizeForSearch(card.title);
  const values = searchableValues(card).map(normalizeForSearch);
  const words = uniq(
    [title, ...values].flatMap(text => [text, ...text.split(WORD_SEPARATORS)])
  ).filter(Boolean);
  const entry = { title, words, text: [title, ...values].join('\n') };
  ENTRIES.set(card, entry);
  return entry;
}

function rankTerm(entry: ISearchEntry, needles: readonly string[]): TRank {
  let best: TRank = Rank.None;
  for (const needle of needles) {
    if (entry.title.startsWith(needle)) {
      return Rank.TitleStart;
    }
    if (entry.words.some(word => word.startsWith(needle))) {
      best = Rank.WordStart;
    } else if (best === Rank.None && entry.text.includes(needle)) {
      best = Rank.Substring;
    }
  }
  return best;
}

/**
 * Every term of the query must be found, as typed or in the
 * other keyboard layout; a card ranks by its weakest term (title start >
 * word start > substring), ties keep the given order. Secret values are
 * never indexed. One linear pass over cached strings per keystroke.
 */
export function searchCards<Card extends ICardState>(
  cards: readonly Card[],
  query: string
): readonly Card[] {
  const terms = normalizeForSearch(query).split(TERM_SEPARATORS).filter(Boolean);
  if (terms.length === 0) {
    return cards;
  }
  const needles = terms.map(term => uniq([term, normalizeForSearch(inOtherLayout(term))]));
  const ranked: { readonly card: Card; readonly rank: number; readonly index: number }[] = [];
  cards.forEach((card, index) => {
    const entry = entryOf(card);
    const rank = Math.min(...needles.map(termNeedles => rankTerm(entry, termNeedles)));
    if (rank > Rank.None) {
      ranked.push({ card, rank, index });
    }
  });
  return ranked
    .sort((first, second) => second.rank - first.rank || first.index - second.index)
    .map(({ card }) => card);
}
