import { describe, expect, it } from 'vitest';

import { normalizeTurnDegrees } from './units';

describe('normalizeTurnDegrees', () => {
  it('leaves an angle already inside a turn alone', () => {
    expect(normalizeTurnDegrees(0)).toBe(0);
    expect(normalizeTurnDegrees(359.5)).toBe(359.5);
  });

  it('folds a whole turn back onto its start', () => {
    expect(normalizeTurnDegrees(360)).toBe(0);
    expect(normalizeTurnDegrees(725)).toBe(5);
  });

  it('reads a turn the other way as its positive twin', () => {
    expect(normalizeTurnDegrees(-90)).toBe(270);
    expect(normalizeTurnDegrees(-450)).toBe(270);
  });
});
