import { DEFAULT_COLUMN_WIDTH, resolveWidths } from './column-widths';

const request = (id: string, rest: Partial<Parameters<typeof resolveWidths>[0][number]> = {}) => ({
  id,
  width: undefined,
  flex: undefined,
  minWidth: undefined,
  maxWidth: undefined,
  ...rest,
});

describe('column widths', () => {
  it('gives fixed columns their width clamped to the bounds', () => {
    const widths = resolveWidths(
      [
        request('a', { width: 10, minWidth: 50 }),
        request('b', { width: 500, maxWidth: 300 }),
        request('c'),
      ],
      1000
    );
    expect([...widths.values()]).toEqual([50, 300, DEFAULT_COLUMN_WIDTH]);
  });

  it('shares the remaining viewport between flex columns by their flex', () => {
    const widths = resolveWidths(
      [
        request('fixed', { width: 100 }),
        request('one', { flex: 1 }),
        request('three', { flex: 3 }),
      ],
      500
    );
    expect(widths.get('one')).toBe(100);
    expect(widths.get('three')).toBe(300);
  });

  it('hands the share a bounded flex column cannot take to the others', () => {
    const widths = resolveWidths(
      [request('capped', { flex: 1, maxWidth: 50 }), request('free', { flex: 1 })],
      400
    );
    expect(widths.get('capped')).toBe(50);
    expect(widths.get('free')).toBe(350);
  });

  it('falls back to the default width for flex columns without a viewport', () => {
    const widths = resolveWidths([request('a', { flex: 2 })], undefined);
    expect(widths.get('a')).toBe(DEFAULT_COLUMN_WIDTH);
  });
});
