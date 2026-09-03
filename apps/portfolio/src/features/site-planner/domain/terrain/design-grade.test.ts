import { describe, expect, it } from 'vitest';

import type { MultiPolygon } from '../geometry/polygon-types';
import type { GradedPad } from './design-grade';
import { groundElevationAt, PAD_BLEND_METERS } from './design-grade';
import type { Heightfield } from './heightfield';

/** A 20×20 m plot falling one metre per ten eastward: z = 100 − x/10. */
function slopingField(): Heightfield {
  const resolution = 21;
  const heights = new Float32Array(resolution * resolution);

  for (let row = 0; row < resolution; row += 1) {
    for (let column = 0; column < resolution; column += 1) {
      heights[row * resolution + column] = 100 - column / 10;
    }
  }

  return {
    resolution,
    originMeters: { x: 0, y: 0 },
    cellSizeMeters: 1,
    heights,
  };
}

const PAD_SHAPE: MultiPolygon = [
  {
    outer: [
      { x: 5, y: 5 },
      { x: 15, y: 5 },
      { x: 15, y: 15 },
      { x: 5, y: 15 },
    ],
    holes: [],
  },
];

/** The pad was levelled at the mean of the ground it covers. */
const PAD: GradedPad = { polygons: PAD_SHAPE, elevation: 99 };

describe('groundElevationAt', () => {
  it('reads the natural terrain far from any pad', () => {
    const elevation = groundElevationAt(slopingField(), [PAD], { x: 19, y: 10 });

    expect(elevation).toBeCloseTo(98.1, 1);
  });

  it('holds the pad elevation inside the pad', () => {
    const elevation = groundElevationAt(slopingField(), [PAD], { x: 10, y: 10 });

    expect(elevation).toBe(99);
  });

  it('blends across the made ground beside the pad, not jumping to the survey', () => {
    const field = slopingField();
    const justOutside = groundElevationAt(field, [PAD], { x: 15.3, y: 10 });
    const natural = groundElevationAt(field, [], { x: 15.3, y: 10 });

    // A post 0.3 m from the цоколь stands on fill, near the pad's level —
    // reading the virgin survey there would drop it by the whole cut.
    expect(Math.abs(justOutside - 99)).toBeLessThan(Math.abs(justOutside - natural));
  });

  it('has returned to the natural grade past the blend distance', () => {
    const field = slopingField();
    const point = { x: 15 + PAD_BLEND_METERS + 0.5, y: 10 };

    expect(groundElevationAt(field, [PAD], point)).toBeCloseTo(groundElevationAt(field, [], point));
  });

  it('falls back to the terrain when nothing has been graded', () => {
    const field = slopingField();

    expect(groundElevationAt(field, [], { x: 10, y: 10 })).toBeCloseTo(99, 1);
  });
});
