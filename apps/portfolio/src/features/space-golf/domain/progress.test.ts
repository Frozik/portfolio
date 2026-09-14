import { describe, expect, it } from 'vitest';

import { completeLevel, INITIAL_PROGRESS } from './progress';

describe('completeLevel', () => {
  it('adds the strokes to the total and moves on to the next level', () => {
    const once = completeLevel(INITIAL_PROGRESS, 4);
    const twice = completeLevel(once, 3);

    expect(once).toEqual({ levelNumber: 2, totalStrokes: 4 });
    expect(twice).toEqual({ levelNumber: 3, totalStrokes: 7 });
  });
});
