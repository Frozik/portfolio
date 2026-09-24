import { describe, expect, it } from 'vitest';

import { distanceBetweenSegments } from '../collision';
import { createRod, rodPath, rodWidth } from '../rods';
import { createBlock } from '../walls';
import { placeRods } from './place-rods';
import type { Random } from './random';

/** Always the first face, the middle of it, and as many rods as may be. */
const STEADY: Random = {
  next: () => 0.5,
  int: (_min, max) => max,
  chance: () => false,
  pick: items => items[0],
};

/**
 * Two blocks one above the other, three metres apart: the upper one's
 * underside is the first plain face there is, and a rod from the middle of
 * it slides straight down to the lower one's top.
 */
const GROUND = {
  walls: [createBlock(0, 4, 4, 4), createBlock(0, 0, 4, 1)],
  neighbourWalls: [],
  spikes: [],
  floaters: [],
};

describe('placeRods', () => {
  it('bridges the gap when nothing is in the way', () => {
    const rods = placeRods(STEADY, GROUND, [], []);

    expect(rods.length).toBeGreaterThan(0);
    expect(rods[0].base).toEqual({ x: 2, y: 4 });
    expect(rods[0].direction).toEqual({ x: 0, y: -1 });
  });

  it('never lays a rod across another, though every end of each is well clear of the other', () => {
    // A rod already standing runs right through the gap, crossing where the new one would go.
    const across = createRod('slide', { x: -1, y: 2.5 }, { x: 1, y: 0 }, 6);

    const rods = placeRods(STEADY, GROUND, [], [across]);

    for (const rod of rods) {
      expect(distanceBetweenSegments(rodPath(rod), rodPath(across))).toBeGreaterThanOrEqual(
        rodWidth(rod.kind) / 2 + rodWidth(across.kind) / 2
      );
    }
    expect(rods).toHaveLength(0);
  });

  it("keeps a rod a rod's width off one running alongside", () => {
    const alongside = createRod(
      'slide',
      { x: 2 + rodWidth('slide') * 0.9, y: 4 },
      { x: 0, y: -1 },
      3
    );

    expect(placeRods(STEADY, GROUND, [], [alongside])).toHaveLength(0);
  });
});
