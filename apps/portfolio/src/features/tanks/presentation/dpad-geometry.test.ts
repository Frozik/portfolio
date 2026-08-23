import { describe, expect, it } from 'vitest';

import { resolveDpadDirection } from './dpad-geometry';

describe('resolveDpadDirection', () => {
  it('maps the four cardinal offsets to their zones', () => {
    expect(resolveDpadDirection(0, -40)).toBe('up');
    expect(resolveDpadDirection(40, 0)).toBe('right');
    expect(resolveDpadDirection(0, 40)).toBe('down');
    expect(resolveDpadDirection(-40, 0)).toBe('left');
  });

  it('splits the square along its diagonals rather than by axis dominance', () => {
    expect(resolveDpadDirection(30, -50)).toBe('up');
    expect(resolveDpadDirection(50, -30)).toBe('right');
    expect(resolveDpadDirection(-50, 30)).toBe('left');
    expect(resolveDpadDirection(-30, 50)).toBe('down');
  });

  it('answers the same zone regardless of how far out the pointer is', () => {
    expect(resolveDpadDirection(1, -2)).toBe('up');
    expect(resolveDpadDirection(500, -1000)).toBe('up');
  });

  /** Each corner belongs to the zone whose sweep starts there, so a thumb resting exactly on a
   * diagonal reports one stable direction instead of flickering between two. */
  it('breaks corner ties deterministically', () => {
    expect(resolveDpadDirection(40, -40)).toBe('right');
    expect(resolveDpadDirection(40, 40)).toBe('down');
    expect(resolveDpadDirection(-40, 40)).toBe('left');
    expect(resolveDpadDirection(-40, -40)).toBe('up');
  });
});
