import { describe, expect, it } from 'vitest';

import { completeLevel, INITIAL_PROGRESS } from './progress';

describe('completeLevel', () => {
  it('adds the strokes, keeps the best and moves to the next level', () => {
    const once = completeLevel(INITIAL_PROGRESS, 1, 4);
    const again = completeLevel(once, 1, 3);

    expect(once).toEqual({ levelNumber: 2, totalStrokes: 4, bestByLevel: { '1': 4 } });
    expect(again.bestByLevel['1']).toBe(3);
    expect(again.totalStrokes).toBe(7);
    expect(again.levelNumber).toBe(2);
  });
});
