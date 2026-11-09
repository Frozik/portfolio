import {
  bookOf,
  contact,
  custom,
  MY_CONTACTS_ID,
  STRANGERS_ID,
  stranger,
} from '../testing/group-book-fixtures';
import type { TGroupId } from './group';
import { moveTargets } from './move-targets';

const ids = (groups: readonly { readonly id: TGroupId }[]) => groups.map(group => group.id);

describe('where a call can move', () => {
  const book = bookOf([custom('spam', []), custom('delivery', [])]);

  it('never back into the group the call is in now', () => {
    expect(ids(moveTargets(book, 'spam' as TGroupId, stranger('31201234567')))).toEqual([
      'delivery',
    ]);
  });

  it('offers «my contacts» only to a contact', () => {
    expect(ids(moveTargets(book, STRANGERS_ID, contact('Mum', '31612345678')))).toEqual([
      'spam',
      'delivery',
      MY_CONTACTS_ID,
    ]);
    expect(ids(moveTargets(book, STRANGERS_ID, stranger('31201234567')))).not.toContain(
      MY_CONTACTS_ID
    );
  });

  it('is nowhere while the user has no group of their own', () => {
    expect(moveTargets(bookOf([]), STRANGERS_ID, stranger('31201234567'))).toEqual([]);
  });
});
