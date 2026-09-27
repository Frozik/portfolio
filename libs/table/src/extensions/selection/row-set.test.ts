import { ALL_ROWS, isRowSelected, NO_ROWS, selectedCount, withRow, withRows } from './row-set';

describe('row selection set', () => {
  it('adds and removes keys of a plain selection', () => {
    const selection = withRows(NO_ROWS, ['a', 'b'], true);
    expect(isRowSelected(selection, 'a')).toBe(true);
    expect(isRowSelected(withRow(selection, 'a', false), 'a')).toBe(false);
    expect(selectedCount(selection, 100)).toBe(2);
  });

  it('tracks exceptions of an inverted selection and counts against the row count', () => {
    const selection = withRow(ALL_ROWS, 'x', false);
    expect(isRowSelected(selection, 'x')).toBe(false);
    expect(isRowSelected(selection, 'anything else')).toBe(true);
    expect(selectedCount(selection, 100)).toBe(99);
    expect(selectedCount(selection, undefined)).toBeUndefined();
    expect(isRowSelected(withRow(selection, 'x', true), 'x')).toBe(true);
  });
});
