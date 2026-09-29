import { describe, expect, it } from 'vitest';

import { toFullYear } from './year';

describe('toFullYear', () => {
  it.each([
    [0, 2000],
    [5, 2005],
    [25, 2025],
    [49, 2049],
  ])('reads a two-digit year below the pivot as this century: %d → %d', (year, expected) => {
    expect(toFullYear(year)).toBe(expected);
  });

  it.each([
    [50, 1950],
    [82, 1982],
    [99, 1999],
  ])('reads a two-digit year from the pivot on as the last century: %d → %d', (year, expected) => {
    expect(toFullYear(year)).toBe(expected);
  });

  it.each([100, 1999, 2024])('leaves a year of three digits or more as written: %d', year => {
    expect(toFullYear(year)).toBe(year);
  });
});
