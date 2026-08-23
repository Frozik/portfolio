import { describe, expect, it } from 'vitest';

import { EXTRA_LIFE_SCORE_THRESHOLD } from './constants';
import { getEnemyPoints, shouldAwardExtraLife } from './scoring';

describe('getEnemyPoints', () => {
  it('pays the original point tiers', () => {
    expect(getEnemyPoints('basic')).toBe(100);
    expect(getEnemyPoints('fast')).toBe(200);
    expect(getEnemyPoints('power')).toBe(300);
    expect(getEnemyPoints('armor')).toBe(400);
  });
});

describe('shouldAwardExtraLife', () => {
  it('awards on the tick the score crosses the threshold', () => {
    expect(
      shouldAwardExtraLife(EXTRA_LIFE_SCORE_THRESHOLD - 100, EXTRA_LIFE_SCORE_THRESHOLD, false)
    ).toBe(true);
    expect(
      shouldAwardExtraLife(
        EXTRA_LIFE_SCORE_THRESHOLD - 100,
        EXTRA_LIFE_SCORE_THRESHOLD + 300,
        false
      )
    ).toBe(true);
  });

  it('never awards twice', () => {
    expect(
      shouldAwardExtraLife(EXTRA_LIFE_SCORE_THRESHOLD - 100, EXTRA_LIFE_SCORE_THRESHOLD, true)
    ).toBe(false);
    expect(
      shouldAwardExtraLife(EXTRA_LIFE_SCORE_THRESHOLD, EXTRA_LIFE_SCORE_THRESHOLD * 2, false)
    ).toBe(false);
  });

  it('does not award below the threshold', () => {
    expect(shouldAwardExtraLife(0, EXTRA_LIFE_SCORE_THRESHOLD - 1, false)).toBe(false);
  });
});
