import { lateColumnIndex, mergeColumnOrder, moveWithin } from './column-order';

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

  it('moves a column to a bounded index within the order', () => {
    expect(moveWithin(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a']);
    expect(moveWithin(['a', 'b', 'c'], 'c', -5)).toEqual(['c', 'a', 'b']);
    expect(moveWithin(['a', 'b', 'c'], 'missing', 1)).toEqual(['a', 'b', 'c']);
  });
});
