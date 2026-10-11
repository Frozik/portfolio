import { aCard, aDocument, anHlc } from '../testing/builders';
import { createSeededRandom } from '../testing/seeded-random';
import { addToGroup, editCard } from './card-edits';
import { createGroup, deleteGroup, liveGroupIds, updateGroup } from './group-edits';

describe('user groups', () => {
  it('are created one after another and renamed with a new stamp', () => {
    const random = createSeededRandom(8);
    const first = createGroup(aDocument(), 'Work', anHlc(2), random);
    const second = createGroup(first.document, 'Home', anHlc(3), random);

    const renamed = updateGroup(second.document, first.groupId, anHlc(4), { name: 'Office' });

    expect([...renamed.groups.values()].map(group => [group.name, group.order])).toEqual([
      ['Office', 0],
      ['Home', 1],
    ]);
    expect(renamed.groups.get(first.groupId)?.updatedAt).toEqual(anHlc(4));
  });

  it('leave their cards untouched when deleted; the membership just stops counting', () => {
    const card = aCard();
    const { document, groupId } = createGroup(
      aDocument([card]),
      'Work',
      anHlc(2),
      createSeededRandom(9)
    );
    const member = editCard(document, card.id, anHlc(3), current => addToGroup(current, groupId));

    const deleted = deleteGroup(member, groupId, anHlc(4));

    expect(deleted.cards.get(card.id)?.groupIds).toEqual([groupId]);
    expect(liveGroupIds(deleted, [groupId])).toEqual([]);
    expect(deleted.tombstones.get(`group:${groupId}`)).toEqual(anHlc(4));
  });
});
