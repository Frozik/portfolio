import { patternCode } from './pattern-code';

describe('a pattern on the 3×3 grid', () => {
  it('is the points in the order the finger went through them', () => {
    expect(patternCode([0, 1, 4, 7])).toEqual({ ok: true, value: 'pattern:0-1-4-7' });
  });

  it('keeps a point the finger came back to, wherever in the pattern', () => {
    expect([patternCode([0, 1, 2, 5, 1]), patternCode([0, 1, 0, 2, 5, 8])]).toEqual([
      { ok: true, value: 'pattern:0-1-2-5-1' },
      { ok: true, value: 'pattern:0-1-0-2-5-8' },
    ]);
  });

  it('adds no point the finger did not go through', () => {
    expect(patternCode([0, 2, 5, 8])).toEqual({ ok: true, value: 'pattern:0-2-5-8' });
  });

  it('is no pattern with fewer than four different points, however long', () => {
    expect([patternCode([0, 1, 2]), patternCode([0, 1, 0, 1, 0])]).toEqual([
      { ok: false, error: 'too-short' },
      { ok: false, error: 'too-short' },
    ]);
  });

  it('refuses a point off the grid', () => {
    expect(patternCode([0, 1, 2, 9])).toEqual({ ok: false, error: 'off-grid' });
  });
});
