import { compareValues, nextSortState, sortRows } from './table-sorting';

describe('nextSortState', () => {
  it('sorts a fresh column descending first — the interesting rows come to the top', () => {
    expect(nextSortState(null, 'score')).toEqual({ columnId: 'score', direction: 'desc' });
  });

  it('flips to ascending on a second click', () => {
    expect(nextSortState({ columnId: 'score', direction: 'desc' }, 'score')).toEqual({
      columnId: 'score',
      direction: 'asc',
    });
  });

  it('clears the sort on a third click', () => {
    expect(nextSortState({ columnId: 'score', direction: 'asc' }, 'score')).toBeNull();
  });

  it('starts over when a different column is clicked', () => {
    expect(nextSortState({ columnId: 'score', direction: 'asc' }, 'name')).toEqual({
      columnId: 'name',
      direction: 'desc',
    });
  });
});

describe('compareValues', () => {
  it('compares numbers numerically', () => {
    expect(compareValues(2, 10)).toBeLessThan(0);
  });

  it('compares digits inside text numerically, not alphabetically', () => {
    expect(compareValues('Ель 9', 'Ель 10')).toBeLessThan(0);
  });

  it('sends absent values to the end whichever way the column is sorted', () => {
    expect(compareValues(undefined, 1)).toBeGreaterThan(0);
    expect(compareValues(1, null)).toBeLessThan(0);
  });
});

describe('sortRows', () => {
  const rows = [{ n: 3 }, { n: 1 }, { n: 2 }];
  const valueOf = (row: { n: number }) => row.n;

  it('returns the rows untouched when nothing is sorted', () => {
    expect(sortRows(rows, null, valueOf)).toBe(rows);
  });

  it('never mutates the input', () => {
    sortRows(rows, { columnId: 'n', direction: 'asc' }, valueOf);
    expect(rows.map(r => r.n)).toEqual([3, 1, 2]);
  });

  it('sorts both ways', () => {
    expect(sortRows(rows, { columnId: 'n', direction: 'asc' }, valueOf).map(r => r.n)).toEqual([
      1, 2, 3,
    ]);
    expect(sortRows(rows, { columnId: 'n', direction: 'desc' }, valueOf).map(r => r.n)).toEqual([
      3, 2, 1,
    ]);
  });
});
