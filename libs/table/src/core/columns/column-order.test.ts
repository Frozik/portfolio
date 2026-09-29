import { lateColumnIndex, mergeColumnOrder, moveToSlot } from './column-order';

describe('column order', () => {
  it('keeps the definition order when nothing was persisted', () => {
    expect(mergeColumnOrder(['a', 'b', 'c'], undefined)).toEqual(['a', 'b', 'c']);
  });

  it('respects the persisted order and drops ids that no longer exist', () => {
    expect(mergeColumnOrder(['a', 'b', 'c'], ['c', 'gone', 'a', 'b'])).toEqual(['c', 'a', 'b']);
  });

  it('places a column that appeared after persisting right after its definition neighbour', () => {
    expect(mergeColumnOrder(['a', 'b', 'late', 'c'], ['c', 'b', 'a'])).toEqual([
      'c',
      'b',
      'late',
      'a',
    ]);
  });

  it('places a late column whose neighbours are all late at the front', () => {
    expect(lateColumnIndex(['late', 'a'], ['a'], 'late')).toBe(0);
  });

  it('moves a column to a slot among its visible neighbours, leaving hidden and pinned columns in place', () => {
    const order = ['pinned', 'a', 'hidden', 'b', 'c'];
    const slots = ['a', 'b', 'c'];
    expect(
      moveToSlot(
        order,
        'c',
        slots.filter(id => id !== 'c'),
        1
      )
    ).toEqual(['pinned', 'a', 'hidden', 'c', 'b']);
    expect(moveToSlot(order, 'a', ['b', 'c'], 2)).toEqual(['pinned', 'hidden', 'b', 'c', 'a']);
    expect(moveToSlot(order, 'a', ['b', 'c'], -5)).toEqual(['pinned', 'hidden', 'a', 'b', 'c']);
    expect(moveToSlot(order, 'pinned', [], 0)).toEqual(order);
    expect(moveToSlot(order, 'missing', slots, 1)).toEqual(order);
  });
});
