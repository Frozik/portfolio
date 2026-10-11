import { aCard, aDocument, anHlc } from '../testing/builders';
import { expireTrash, purgeDueAt, TRASH_RETENTION_DAYS } from './trash';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('trash', () => {
  it('tells when a trashed card goes for good, thirty days on', () => {
    expect(purgeDueAt(aCard({ trashedAt: anHlc(1_000) }))).toBe(
      1_000 + TRASH_RETENTION_DAYS * DAY_MS
    );
    expect(purgeDueAt(aCard())).toBeNull();
  });

  it('deletes only the cards past their term, leaving a tombstone for each', () => {
    const old = aCard({ title: 'old', trashedAt: anHlc(0) });
    const recent = aCard({ title: 'recent', trashedAt: anHlc(20 * DAY_MS) });
    const kept = aCard({ title: 'kept' });

    const expired = expireTrash(aDocument([old, recent, kept]), 31 * DAY_MS, anHlc(31 * DAY_MS));

    expect([...expired.cards.values()].map(card => card.title).sort()).toEqual(['kept', 'recent']);
    expect(expired.tombstones.has(`card:${old.id}`)).toBe(true);
  });

  it('leaves the document as it was when nothing is due', () => {
    const document = aDocument([aCard({ trashedAt: anHlc(0) })]);

    expect(expireTrash(document, DAY_MS, anHlc(DAY_MS))).toBe(document);
  });
});
