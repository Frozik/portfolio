import { aCard, aDocument, anHlc } from '../testing/builders';
import { createSeededRandom } from '../testing/seeded-random';
import { allFields } from './card';
import {
  archiveCard,
  createCard,
  duplicateCard,
  editCard,
  editCards,
  renameCard,
  setFavorite,
  trashCard,
} from './card-edits';
import { BANK_ACCOUNT_US_TEMPLATE } from './templates/bank-account-us';
import { DOCUMENT_TEMPLATE } from './templates/document';
import { INTERNET_ACCOUNT_TEMPLATE } from './templates/internet-account';

const translate = (key: string): string => `«${key}»`;
const random = createSeededRandom(11);

describe('creating a card from a template', () => {
  it('copies the fields with labels in the language of creation and the default secrecy of each kind', () => {
    const card = createCard(INTERNET_ACCOUNT_TEMPLATE, { translate, random }, anHlc(5));

    expect(card.tabs).toHaveLength(1);
    expect(card.tabs[0].title).toBeNull();
    expect(
      allFields(card).map(field => [
        field.label,
        field.spec.kind,
        field.sensitive,
        field.value.cardinality,
      ])
    ).toEqual([
      ['«field.websites»', 'url', false, 'list'],
      ['«field.login»', 'login', false, 'single'],
      ['«field.password»', 'password', true, 'single'],
      ['«field.email»', 'email', false, 'single'],
      ['«field.notes»', 'note', false, 'single'],
    ]);
    expect(card.createdAt).toEqual(anHlc(5));
  });

  it('names the tabs of a template that has several and keeps national schemes of bank codes', () => {
    const passport = createCard(DOCUMENT_TEMPLATE, { translate, random }, anHlc(5));
    const usAccount = createCard(BANK_ACCOUNT_US_TEMPLATE, { translate, random }, anHlc(5));

    expect(passport.tabs.map(tab => tab.title)).toEqual(['«tab.details»', '«tab.scans»']);
    expect(allFields(usAccount).find(field => field.spec.kind === 'bank-code')?.spec).toEqual({
      kind: 'bank-code',
      scheme: 'aba-routing',
    });
    expect(allFields(usAccount).find(field => field.spec.kind === 'select')?.spec).toMatchObject({
      options: ['«option.checking»', '«option.savings»'],
    });
  });
});

describe('editing a card in the document', () => {
  it('stamps the edited card and leaves every other card the same object', () => {
    const edited = aCard({ title: 'Old' });
    const untouched = aCard();
    const document = aDocument([edited, untouched]);

    const next = editCard(document, edited.id, anHlc(10), card => renameCard(card, 'New'));

    expect(next.cards.get(edited.id)).toMatchObject({ title: 'New', updatedAt: anHlc(10) });
    expect(next.cards.get(untouched.id)).toBe(untouched);
  });

  it('returns the same document when the change changes nothing', () => {
    const card = aCard({ favorite: true });
    const document = aDocument([card]);

    expect(editCard(document, card.id, anHlc(10), current => setFavorite(current, true))).toBe(
      document
    );
  });

  it('archives and trashes once, keeping the first stamp', () => {
    const card = aCard();
    const archived = archiveCard(card, anHlc(2));
    const trashed = trashCard(archived, anHlc(3));

    expect(archiveCard(archived, anHlc(9)).archivedAt).toEqual(anHlc(2));
    expect(trashCard(trashed, anHlc(9)).trashedAt).toEqual(anHlc(3));
    expect(trashed.archivedAt).toEqual(anHlc(2));
  });
});

describe('copies and multi-selection', () => {
  it('duplicates a card with fresh ids and no history', () => {
    const original = createCard(INTERNET_ACCOUNT_TEMPLATE, { translate, random }, anHlc(5));
    const copy = duplicateCard(
      { ...original, history: [{ at: anHlc(4), snapshot: original }] },
      'Copy',
      random,
      anHlc(9)
    );

    expect(copy.id).not.toBe(original.id);
    expect(copy.title).toBe('Copy');
    expect(allFields(copy).map(field => field.label)).toEqual(
      allFields(original).map(field => field.label)
    );
    expect(
      allFields(copy).some(field => allFields(original).some(other => other.id === field.id))
    ).toBe(false);
    expect(copy.history).toEqual([]);
    expect(copy.createdAt).toEqual(anHlc(9));
  });

  it('applies one edit to every selected card under one stamp', () => {
    const first = aCard();
    const second = aCard();
    const untouched = aCard();

    const next = editCards(
      aDocument([first, second, untouched]),
      [first.id, second.id],
      anHlc(10),
      card => setFavorite(card, true)
    );

    expect([...next.cards.values()].map(card => card.favorite)).toEqual([true, true, false]);
  });
});
