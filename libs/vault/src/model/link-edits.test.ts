import { assert } from '@frozik/utils/assert/assert';

import { aCard, aDocument, anHlc } from '../testing/builders';
import { linkCards, linkedCardIds, linkIdOf, unlinkCards } from './link-edits';
import { purgeCard } from './purge-card';

describe('card links', () => {
  const bank = aCard({ title: 'Bank' });
  const card = aCard({ title: 'Card' });
  const phone = aCard({ title: 'Phone', trashedAt: anHlc(3) });

  it('derive one id from the pair, whichever card links first', () => {
    expect(linkIdOf(bank.id, card.id)).toBe(linkIdOf(card.id, bank.id));
  });

  it('refuse to link a card to itself or to a card that is not there', () => {
    const document = aDocument([bank]);

    expect(linkCards(document, bank.id, bank.id, anHlc(2))).toEqual({
      ok: false,
      error: { kind: 'self-link' },
    });
    expect(linkCards(document, bank.id, card.id, anHlc(2))).toEqual({
      ok: false,
      error: { kind: 'card-missing' },
    });
  });

  it('show neighbours both ways and hide the ones in the trash', () => {
    const linked = linkCards(aDocument([bank, card, phone]), bank.id, card.id, anHlc(2));
    assert(linked.ok);
    const withPhone = linkCards(linked.value, phone.id, bank.id, anHlc(3));
    assert(withPhone.ok);

    expect(linkedCardIds(withPhone.value, bank.id)).toEqual([card.id]);
    expect(linkedCardIds(withPhone.value, card.id)).toEqual([bank.id]);
  });

  it('come back when linked again after an unlink', () => {
    const linked = linkCards(aDocument([bank, card]), bank.id, card.id, anHlc(2));
    assert(linked.ok);
    const unlinked = unlinkCards(linked.value, linkIdOf(bank.id, card.id), anHlc(3));
    const relinked = linkCards(unlinked, card.id, bank.id, anHlc(4));
    assert(relinked.ok);

    expect(linkedCardIds(unlinked, bank.id)).toEqual([]);
    expect(linkedCardIds(relinked.value, bank.id)).toEqual([card.id]);
  });

  it('go with a purged card under the same stamp as the card itself', () => {
    const linked = linkCards(aDocument([bank, card]), bank.id, card.id, anHlc(2));
    assert(linked.ok);

    const purged = purgeCard(linked.value, card.id, anHlc(7));

    expect(purged.cards.has(card.id)).toBe(false);
    expect(purged.links.size).toBe(0);
    expect(purged.tombstones.get(`card:${card.id}`)).toEqual(anHlc(7));
    expect(purged.tombstones.get(`link:${linkIdOf(bank.id, card.id)}`)).toEqual(anHlc(7));
  });
});
