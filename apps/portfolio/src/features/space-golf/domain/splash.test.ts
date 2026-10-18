import { describe, expect, it } from 'vitest';

import type { FaceKind } from './level';
import { SPLASH_SECONDS, splashesAfter } from './splash';
import type { Touch } from './step';

const STEP = 1 / 120;

function touch(kind: FaceKind, speed: number, at: Touch['at'] = 'face'): Touch {
  return { point: { x: 3, y: 1 }, normal: { x: 0, y: 1 }, kind, at, speed };
}

describe('splashesAfter', () => {
  it('splashes where the ball lands on an island, an elastic or a viscous surface, coloured by which', () => {
    const touches = [
      touch('floor', 4),
      touch('deflector', 4),
      touch('bounce', 4),
      touch('sticky', 4),
    ];

    const splashes = splashesAfter([], touches, STEP);

    expect(splashes.map(splash => splash.material)).toEqual([
      'island',
      'island',
      'bounce',
      'sticky',
    ]);
    expect(splashes[0].point).toEqual({ x: 3, y: 1 });
    expect(splashes[0].normal).toEqual({ x: 0, y: 1 });
  });

  it('raises none off a floater, a rod, the cup or a corner', () => {
    const touches = [
      touch('floater', 4),
      touch('rod', 4),
      touch('cup', 4),
      touch('floor', 4, 'corner'),
      touch('bounce', 4, 'corner'),
    ];

    expect(splashesAfter([], touches, STEP)).toEqual([]);
  });

  it('raises none while the ball only rolls or lies on the face', () => {
    expect(splashesAfter([], [touch('sticky', 0.05)], STEP)).toEqual([]);
  });

  it('splashes harder the harder the ball lands', () => {
    const [soft] = splashesAfter([], [touch('sticky', 1.5)], STEP);
    const [hard] = splashesAfter([], [touch('sticky', 5)], STEP);

    expect(hard.strength).toBeGreaterThan(soft.strength);
    expect(hard.strength).toBeLessThanOrEqual(1);
  });

  it('throws the same drops for the same landing', () => {
    const [first] = splashesAfter([], [touch('bounce', 4)], STEP);
    const [again] = splashesAfter([], [touch('bounce', 4)], STEP);

    expect(again.seed).toBe(first.seed);
  });

  it('is gone a second after the landing', () => {
    let splashes = splashesAfter([], [touch('bounce', 4)], STEP);
    let lasted = 0;
    while (splashes.length > 0 && lasted < 10) {
      splashes = splashesAfter(splashes, [], STEP);
      lasted += STEP;
    }

    expect(lasted).toBeCloseTo(SPLASH_SECONDS, 1);
  });
});
