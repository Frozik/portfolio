import { ALWAYS_BLOCK } from '../../policy/domain/policy';
import {
  bookOf,
  contact,
  custom,
  factsWith,
  MY_CONTACTS_ID,
  newMemberId,
  NOW,
  numberMask,
  pickedContact,
} from '../testing/group-book-fixtures';
import { detectConflicts } from './conflict-detection';
import { resolutionsFor } from './conflict-resolutions';
import type { TGroupId } from './group';
import { addMember, createGroup, deleteGroup, removeMember } from './group-book-edits';
import { applyChanges } from './group-changes';
import { membership } from './membership';

const facts = factsWith();

describe('editing the group book', () => {
  it('creates a group of the user before the two special groups', () => {
    const outcome = createGroup(bookOf([]), {
      id: 'spam' as TGroupId,
      name: 'Spam',
      color: 'red',
      policy: ALWAYS_BLOCK,
      now: NOW,
    });
    expect(outcome.kind === 'applied' && outcome.book.groups.map(group => group.id)).toEqual([
      'spam',
      MY_CONTACTS_ID,
      'strangers',
    ]);
  });

  it('adds a picked contact and takes it out of «my contacts» in the same step', () => {
    const mum = pickedContact('Mum', '31612345678');
    const outcome = addMember(bookOf([custom('family', [])]), {
      group: 'family' as TGroupId,
      side: 'include',
      member: mum,
      newMemberId,
      now: NOW,
      facts,
    });
    expect(outcome.kind).toBe('applied');
    if (outcome.kind === 'applied') {
      expect(
        membership(outcome.book, contact('Mum', '31612345678'), facts.environment)
      ).toMatchObject({
        kind: 'one',
        group: { id: 'family' },
      });
    }
  });

  it('gives the exclusion back when the contact leaves the group', () => {
    const mum = pickedContact('Mum', '31612345678');
    const added = addMember(bookOf([custom('family', [])]), {
      group: 'family' as TGroupId,
      side: 'include',
      member: mum,
      newMemberId,
      now: NOW,
      facts,
    });
    if (added.kind !== 'applied') {
      throw new Error('expected applied');
    }
    const removed = removeMember(added.book, 'family' as TGroupId, 'include', mum.id, NOW);
    expect(
      removed.kind === 'applied' &&
        membership(removed.book, contact('Mum', '31612345678'), facts.environment)
    ).toMatchObject({
      kind: 'one',
      group: { id: MY_CONTACTS_ID },
    });
  });

  it('stops a mask that would make a conflict until a resolution is chosen', () => {
    const book = bookOf([custom('spam', [numberMask('+7 495*')]), custom('delivery', [])]);
    const outcome = addMember(book, {
      group: 'delivery' as TGroupId,
      side: 'include',
      member: numberMask('+7 495 1*'),
      newMemberId,
      now: NOW,
      facts,
    });
    expect(outcome.kind).toBe('needs-resolution');
    if (outcome.kind !== 'needs-resolution') {
      return;
    }
    const [conflict] = outcome.conflicts;
    const resolution =
      conflict === undefined
        ? undefined
        : resolutionsFor(outcome.proposed, conflict, { newMemberId, now: NOW })[1];
    const resolved = applyChanges(outcome.proposed, resolution?.changes ?? [], NOW).book;
    expect(detectConflicts(resolved, facts)).toEqual([]);
  });

  it('lets a conflict that was already there through: only new ones stop an edit', () => {
    const book = bookOf([
      custom('spam', [numberMask('+7 495*')]),
      custom('delivery', [numberMask('+7 495 1*')]),
    ]);
    const outcome = addMember(book, {
      group: 'spam' as TGroupId,
      side: 'include',
      member: numberMask('+7 499*'),
      newMemberId,
      now: NOW,
      facts,
    });
    expect(outcome.kind).toBe('applied');
  });

  it('takes back the exclusions a deleted group had made elsewhere', () => {
    const mum = pickedContact('Mum', '31612345678');
    const added = addMember(bookOf([custom('family', [])]), {
      group: 'family' as TGroupId,
      side: 'include',
      member: mum,
      newMemberId,
      now: NOW,
      facts,
    });
    if (added.kind !== 'applied') {
      throw new Error('expected applied');
    }
    const deleted = deleteGroup(added.book, 'family' as TGroupId, NOW);
    expect(
      deleted.kind === 'applied' &&
        membership(deleted.book, contact('Mum', '31612345678'), facts.environment)
    ).toMatchObject({
      kind: 'one',
      group: { id: MY_CONTACTS_ID },
    });
  });

  it('refuses members for «strangers» and inclusions for «my contacts»', () => {
    const book = bookOf([]);
    const command = {
      side: 'include' as const,
      member: numberMask('+31*'),
      newMemberId,
      now: NOW,
      facts,
    };
    expect(addMember(book, { ...command, group: 'strangers' as TGroupId })).toEqual({
      kind: 'rejected',
      reason: 'strangers-take-nobody',
    });
    expect(addMember(book, { ...command, group: MY_CONTACTS_ID })).toEqual({
      kind: 'rejected',
      reason: 'not-a-group-of-the-user',
    });
  });
});
