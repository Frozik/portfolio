import { describe, expect, it } from 'vitest';

import { distanceToSegment } from '../collision';
import { CELL_METERS, FLOATER_LARGE_SIDE_METERS } from '../constants';
import { createRod, rodPath, rodWidth } from '../rods';
import { placeFloaters } from './place-floaters';
import type { Random } from './random';

/** As many floaters as may be, always the first admissible spot, never nudged off the grid. */
const STEADY: Random = {
  next: () => 0.5,
  int: (_min, max) => max,
  chance: () => false,
  pick: items => items[0],
};
const REGION = {
  min: { x: 0, y: 0 },
  max: { x: 24 * CELL_METERS, y: 27 * CELL_METERS },
};
const LARGE_REACH_METERS = (FLOATER_LARGE_SIDE_METERS / 2) * Math.SQRT2;

describe('placeFloaters', () => {
  it("keeps every floater's large shape off the path of a rod already standing, where without the rod one would have lain on it", () => {
    // A rod laid right through the first floater there would otherwise be, the width of the region.
    const without = placeFloaters(STEADY, [], REGION, [], [], []);
    const [first] = without;
    const rod = createRod('slide', { x: 0, y: first.center.y }, { x: 1, y: 0 }, 12);
    const path = rodPath(rod);
    const tooNear = (center: { x: number; y: number }): boolean =>
      distanceToSegment(center, path) < LARGE_REACH_METERS + rodWidth(rod.kind) / 2;

    const withRod = placeFloaters(STEADY, [], REGION, [], [], [rod]);

    expect(without.some(floater => tooNear(floater.center))).toBe(true);
    expect(withRod.length).toBeGreaterThan(0);
    expect(withRod.some(floater => tooNear(floater.center))).toBe(false);
  });
});
