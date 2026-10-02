import { describe, expect, it } from 'vitest';

import { numberDomain } from '../viewport/number-domain';
import { lowerBound, upperBound } from './search';

const positions = [1, 3, 3, 3, 7];

describe('column search', () => {
  it('finds where a position would start among equal ones', () => {
    expect(lowerBound(numberDomain, positions, positions.length, 3)).toBe(1);
    expect(lowerBound(numberDomain, positions, positions.length, 0)).toBe(0);
    expect(lowerBound(numberDomain, positions, positions.length, 8)).toBe(5);
  });

  it('finds where the positions after a given one begin', () => {
    expect(upperBound(numberDomain, positions, positions.length, 3)).toBe(4);
    expect(upperBound(numberDomain, positions, positions.length, 7)).toBe(5);
  });

  it('looks only at the given length, so a column may have spare capacity', () => {
    expect(lowerBound(numberDomain, positions, 2, 7)).toBe(2);
  });
});
