import { overlapOf, windowFor } from './snapshot-window';

describe('snapshot window', () => {
  it('rounds the visible range with its buffer out to whole pages', () => {
    expect(windowFor({ start: 0, end: 30 }, 100, 50)).toEqual({ offset: 0, limit: 100 });
    expect(windowFor({ start: 260, end: 300 }, 100, 50)).toEqual({ offset: 200, limit: 200 });
    expect(windowFor({ start: 1_005, end: 1_020 }, 100, 50)).toEqual({ offset: 900, limit: 200 });
  });

  it('keeps the old rows that start the new window, and nothing when the new one starts before them', () => {
    const previous = {
      window: { offset: 100, limit: 100 },
      rows: Array.from({ length: 100 }, (_, index) => 100 + index),
    };
    expect(overlapOf(previous, { offset: 100, limit: 200 })).toHaveLength(100);
    expect(overlapOf(previous, { offset: 150, limit: 100 })).toHaveLength(50);
    expect(overlapOf(previous, { offset: 0, limit: 100 })).toEqual([]);
    expect(overlapOf(undefined, { offset: 0, limit: 100 })).toEqual([]);
  });
});
