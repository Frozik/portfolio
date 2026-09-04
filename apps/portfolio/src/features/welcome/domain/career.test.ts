import { Temporal } from 'temporal-polyfill';

import { findEarliestStart, getYearsOfExperience } from './career';

const date = (iso: string): Temporal.PlainDate => Temporal.PlainDate.from(iso);

describe('career', () => {
  it('counts whole years of experience up to today', () => {
    expect(getYearsOfExperience(date('2010-06-15'), date('2026-06-14'))).toBe(15);
    expect(getYearsOfExperience(date('2010-06-15'), date('2026-06-15'))).toBe(16);
  });

  it('finds the earliest start among unordered entries', () => {
    const earliest = findEarliestStart([
      { start: date('2019-01-01') },
      { start: date('2008-09-01') },
      { start: date('2012-03-10') },
    ]);

    expect(earliest.toString()).toBe('2008-09-01');
  });

  it('refuses an empty career', () => {
    expect(() => findEarliestStart([])).toThrow();
  });
});
