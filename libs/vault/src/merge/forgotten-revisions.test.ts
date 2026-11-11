import { renameCard } from '../model/card-edits';
import { commitCard, forgetRevision } from '../model/revision-edits';
import { aCardWith, anHlc } from '../testing/builders';
import { mergeCard } from './merge-card';

/** A card renamed twice, far enough apart that each earlier version stays in its history. */
function cardWithTwoVersions() {
  const original = aCardWith([], {
    title: 'First',
    updatedAt: anHlc(1000),
    createdAt: anHlc(1000),
  });
  const second = commitCard(original, renameCard(original, 'Second'), anHlc(1_000_000));
  return commitCard(second, renameCard(second, 'Third'), anHlc(2_000_000));
}

describe('a version deleted from a card’s history', () => {
  it('leaves the history and the card as it is now alone', () => {
    const card = cardWithTwoVersions();
    const [newest] = card.history;

    const forgotten = forgetRevision(card, newest?.at ?? anHlc(0));

    expect({
      title: forgotten.title,
      history: forgotten.history.map(revision => revision.snapshot.title),
    }).toEqual({ title: 'Third', history: ['First'] });
  });

  it('stays gone after a merge with a device that still keeps it, in either order', () => {
    const elsewhere = cardWithTwoVersions();
    const [newest] = elsewhere.history;
    const here = forgetRevision(elsewhere, newest?.at ?? anHlc(0));

    const titles = [mergeCard(here, elsewhere), mergeCard(elsewhere, here)].map(merged =>
      merged.history.map(revision => revision.snapshot.title)
    );

    expect(titles).toEqual([['First'], ['First']]);
  });
});
