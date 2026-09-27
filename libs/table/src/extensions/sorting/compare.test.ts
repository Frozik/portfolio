import { Temporal } from 'temporal-polyfill';

import { compareByKind, withNullsLast } from './compare';

describe('compareByKind', () => {
  it('orders numbers numerically and text with numeric awareness', () => {
    expect(compareByKind('number', 2, 10)).toBeLessThan(0);
    expect(compareByKind('text', 'item 2', 'item 10')).toBeLessThan(0);
    expect(compareByKind('text', 'b', 'a')).toBeGreaterThan(0);
  });

  it('orders Temporal values and ISO strings chronologically', () => {
    const earlier = Temporal.Instant.from('2026-01-01T00:00:00Z');
    const later = Temporal.Instant.from('2026-06-01T00:00:00Z');
    expect(compareByKind('datetime', earlier, later)).toBeLessThan(0);
    expect(compareByKind('date', '2026-06-01', '2026-01-01')).toBeGreaterThan(0);
  });

  it('keeps missing values last in both directions', () => {
    const ascending = withNullsLast<unknown, unknown>(
      (left, right) => compareByKind('number', left, right),
      1
    );
    const descending = withNullsLast<unknown, unknown>(
      (left, right) => compareByKind('number', left, right),
      -1
    );
    const rows = [3, null, 1, undefined, 2];

    expect([...rows].sort((left, right) => ascending(left, right, left, right))).toEqual([
      1,
      2,
      3,
      null,
      undefined,
    ]);
    expect([...rows].sort((left, right) => descending(left, right, left, right))).toEqual([
      3,
      2,
      1,
      null,
      undefined,
    ]);
  });
});
