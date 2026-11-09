import { ALWAYS_PASS } from '../../policy/domain/policy';
import { bookOf, custom, NOW, numberMask } from '../testing/group-book-fixtures';
import { mergeBooks } from './book-merge';
import type { GroupBook } from './group-book';
import { sameValue } from './same-value';

const LATER = NOW.add({ minutes: 5 });
const LATEST = NOW.add({ minutes: 10 });

const SPAM_MASK = numberMask('+7 495*');
const DELIVERY_MASK = numberMask('085 *');
const spam = custom('spam', [SPAM_MASK]);
const delivery = custom('delivery', [DELIVERY_MASK]);
const BASE = bookOf([spam, delivery]);

const ids = (book: GroupBook) => book.groups.map(group => group.id);
const customNamed = (book: GroupBook, id: string) => {
  const group = book.groups.find(candidate => candidate.id === id);
  return group?.kind === 'custom' ? group : null;
};

describe('merging the group book of two phones', () => {
  it("keeps what either side added, in the cloud's order first", () => {
    const local = bookOf([spam, delivery, custom('work', [], { updatedAt: LATER })]);
    const remote = bookOf([spam, delivery, custom('family', [], { updatedAt: LATER })]);
    expect(ids(mergeBooks(BASE, local, remote))).toEqual([
      'spam',
      'delivery',
      'family',
      'work',
      'my-contacts',
      'strangers',
    ]);
  });

  it('drops what one side deleted and the other left alone', () => {
    const local = bookOf([spam]);
    expect(ids(mergeBooks(BASE, local, BASE))).not.toContain('delivery');
  });

  it('keeps a group one side deleted while the other edited it: an edit beats a delete', () => {
    const local = bookOf([spam]);
    const remote = bookOf([spam, { ...delivery, name: 'Couriers', updatedAt: LATER }]);
    expect(customNamed(mergeBooks(BASE, local, remote), 'delivery')?.name).toBe('Couriers');
  });

  it('takes the newer edit when both sides changed the same thing', () => {
    const local = bookOf([{ ...spam, name: 'Spam!', updatedAt: LATEST }, delivery]);
    const remote = bookOf([{ ...spam, name: 'Junk', updatedAt: LATER }, delivery]);
    expect(customNamed(mergeBooks(BASE, local, remote), 'spam')?.name).toBe('Spam!');
  });

  it('keeps both edits when the sides changed different things', () => {
    const local = bookOf([{ ...spam, name: 'Junk', updatedAt: LATER }, delivery]);
    const remote = bookOf([{ ...spam, policy: ALWAYS_PASS, updatedAt: LATEST }, delivery]);
    const merged = customNamed(mergeBooks(BASE, local, remote), 'spam');
    expect(merged?.name).toBe('Junk');
    expect(merged?.policy).toEqual(ALWAYS_PASS);
  });

  it('merges the members of a group one by one', () => {
    const added = numberMask('+7 499*');
    const local = bookOf([{ ...spam, include: [SPAM_MASK, added], updatedAt: LATER }, delivery]);
    const remote = bookOf([spam, { ...delivery, include: [], updatedAt: LATER }]);
    const merged = mergeBooks(BASE, local, remote);
    expect(customNamed(merged, 'spam')?.include.map(member => member.id)).toEqual([
      SPAM_MASK.id,
      added.id,
    ]);
    expect(customNamed(merged, 'delivery')?.include).toEqual([]);
  });

  it('takes everything from both sides on the first sync of a phone', () => {
    const local = bookOf([spam]);
    const remote = bookOf([delivery]);
    expect(ids(mergeBooks(null, local, remote))).toEqual([
      'delivery',
      'spam',
      'my-contacts',
      'strangers',
    ]);
  });

  it('changes nothing when both sides agree, or when only one side moved', () => {
    const moved = bookOf([{ ...spam, name: 'Junk', updatedAt: LATER }, delivery]);
    expect(sameValue(mergeBooks(BASE, moved, moved), moved)).toBe(true);
    expect(sameValue(mergeBooks(BASE, moved, BASE), moved)).toBe(true);
    expect(sameValue(mergeBooks(BASE, BASE, moved), moved)).toBe(true);
  });
});

describe('comparing values that hold Temporal moments', () => {
  it('tells two different instants apart', () => {
    expect(sameValue({ at: NOW }, { at: LATER })).toBe(false);
    expect(sameValue({ at: NOW }, { at: NOW.add({ seconds: 0 }) })).toBe(true);
  });
});
