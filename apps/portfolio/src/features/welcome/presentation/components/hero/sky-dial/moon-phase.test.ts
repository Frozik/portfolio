import { describe, expect, it } from 'vitest';

import { moonLitPath } from './moon-phase';

describe('moonLitPath', () => {
  it('draws a full moon as the whole disc', () => {
    expect(moonLitPath(0, 0, 10, 1, true)).toBe('M 0 -10 A 10 10 0 0 1 0 10 A 10 10 0 0 1 0 -10 Z');
  });

  it('lights the right limb of a waxing crescent and the left limb of a waning one', () => {
    expect(moonLitPath(0, 0, 10, 0.25, true)).toContain('A 10 10 0 0 1 0 10');
    expect(moonLitPath(0, 0, 10, 0.25, false)).toContain('A 10 10 0 0 0 0 10');
  });

  it('draws a quarter moon with a straight terminator', () => {
    expect(moonLitPath(0, 0, 10, 0.5, true)).toContain('A 0 10');
  });
});
