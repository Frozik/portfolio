import type { ICaller } from '../../phone/domain/caller';
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
  stranger,
  STRANGERS_ID,
} from '../testing/group-book-fixtures';
import { moveCaller, removeCallerFromGroup } from './caller-move';
import { detectConflicts } from './conflict-detection';
import type { TEditOutcome } from './edit-outcome';
import type { TGroupId } from './group';
import type { GroupBook } from './group-book';
import { membership } from './membership';

function applied(outcome: TEditOutcome): GroupBook {
  if (outcome.kind !== 'applied') {
    throw new Error(`expected applied, got ${outcome.kind}`);
  }
  return outcome.book;
}

function groupOf(book: GroupBook, caller: ICaller): string {
  const found = membership(book, caller, factsWith().environment);
  return found.kind === 'one' ? found.group.id : 'conflict';
}

function move(
  book: GroupBook,
  caller: ICaller,
  target: string,
  by: 'number' | 'name' = 'number'
): TEditOutcome {
  return moveCaller(book, {
    caller,
    by,
    target: target as TGroupId,
    note: '',
    newMemberId,
    now: NOW,
    facts: factsWith([caller]),
  });
}

describe('moving a caller to a group', () => {
  it('takes a stranger into the chosen group with an exact mask', () => {
    const book = bookOf([custom('delivery', [])]);
    const caller = stranger('31851234567');
    const moved = applied(move(book, caller, 'delivery'));
    expect(groupOf(moved, caller)).toBe('delivery');
    expect(groupOf(moved, stranger('31851234568'))).toBe(STRANGERS_ID);
  });

  it('excludes the number from the group whose pattern took it, so no conflict is left', () => {
    const book = bookOf([custom('spam', [numberMask('+7 495*')]), custom('delivery', [])]);
    const caller = stranger('74951234567');
    const moved = applied(move(book, caller, 'delivery'));
    expect(groupOf(moved, caller)).toBe('delivery');
    expect(groupOf(moved, stranger('74951234500'))).toBe('spam');
    expect(detectConflicts(moved, factsWith([caller]))).toEqual([]);
  });

  it('drops the exact mask from the group the caller leaves', () => {
    const caller = stranger('31851234567');
    const book = applied(
      move(bookOf([custom('spam', []), custom('delivery', [])]), caller, 'spam')
    );
    const moved = applied(move(book, caller, 'delivery'));
    const spam = moved.groups.find(group => group.id === 'spam');
    expect(spam?.kind === 'custom' && spam.include).toEqual([]);
    expect(spam?.kind === 'custom' && spam.exclude).toEqual([]);
  });

  it('moves a contact as the person, out of «my contacts»', () => {
    const mum = contact('Mum', '31612345678');
    const moved = applied(move(bookOf([custom('family', [])]), mum, 'family'));
    expect(groupOf(moved, mum)).toBe('family');
    expect(detectConflicts(moved, factsWith([mum]))).toEqual([]);
  });

  it('moves every number an operator name calls from', () => {
    const first = stranger('31851111111', 'PostNL');
    const second = stranger('31852222222', 'PostNL');
    const moved = applied(move(bookOf([custom('delivery', [])]), first, 'delivery', 'name'));
    expect(groupOf(moved, second)).toBe('delivery');
  });

  it('never moves a caller into «strangers», and only contacts into «my contacts»', () => {
    const book = bookOf([]);
    expect(move(book, stranger('31851234567'), STRANGERS_ID)).toEqual({
      kind: 'rejected',
      reason: 'strangers-take-nobody',
    });
    expect(move(book, stranger('31851234567'), MY_CONTACTS_ID)).toEqual({
      kind: 'rejected',
      reason: 'not-a-contact',
    });
  });

  it('has nothing to move for a hidden number', () => {
    const hidden = { number: null, traits: null, networkName: null, contact: null };
    expect(move(bookOf([custom('spam', [])]), hidden, 'spam')).toEqual({
      kind: 'rejected',
      reason: 'nothing-to-move',
    });
  });
});

describe('removing a caller from a group', () => {
  function remove(book: GroupBook, caller: ICaller, group: string): GroupBook {
    return applied(
      removeCallerFromGroup(book, {
        caller,
        by: 'number',
        group: group as TGroupId,
        newMemberId,
        now: NOW,
        facts: factsWith([caller]),
      })
    );
  }

  it('returns a stranger to «strangers»', () => {
    const caller = stranger('31851234567');
    const book = applied(move(bookOf([custom('delivery', [])]), caller, 'delivery'));
    expect(groupOf(remove(book, caller, 'delivery'), caller)).toBe(STRANGERS_ID);
  });

  it('returns a contact to «my contacts», taking back the exclusion the move left there', () => {
    const mum = contact('Mum', '31612345678');
    const book = applied(move(bookOf([custom('family', [])]), mum, 'family'));
    expect(groupOf(remove(book, mum, 'family'), mum)).toBe(MY_CONTACTS_ID);
  });

  it('excepts a caller the group takes by pattern', () => {
    const caller = stranger('74951234567');
    const book = bookOf([custom('spam', [numberMask('+7 495*')])]);
    expect(groupOf(remove(book, caller, 'spam'), caller)).toBe(STRANGERS_ID);
  });

  it('keeps a picked contact apart from the exclusion the user wrote', () => {
    const mum = pickedContact('Mum', '31612345678');
    const book = bookOf([custom('family', [mum])], [{ ...mum, id: newMemberId() }]);
    expect(
      groupOf(remove(book, contact('Mum', '31612345678'), 'family'), contact('Mum', '31612345678'))
    ).toBe(STRANGERS_ID);
  });
});
