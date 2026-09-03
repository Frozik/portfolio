import { describe, expect, it } from 'vitest';

import type { MultiPolygon } from './polygon-types';
import {
  buildFloorPlate,
  buildRoofPlate,
  floorToFloorMeters,
  SLAB_THICKNESS_METERS,
} from './storey-plates';

const SQUARE: MultiPolygon = [
  {
    outer: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    holes: [],
  },
];

const STAIR_CUTOUT: MultiPolygon = [
  {
    outer: [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 5 },
      { x: 1, y: 5 },
    ],
    holes: [],
  },
];

describe('buildFloorPlate', () => {
  it('hangs the slab immediately below the finished floor', () => {
    const plate = buildFloorPlate({ footprint: SQUARE, cutouts: [], floorElevation: 103 });

    expect(plate?.topElevation).toBe(103);
    expect(plate?.baseElevation).toBeCloseTo(103 - SLAB_THICKNESS_METERS);
  });

  it('pierces the slab with a stair cutout, leaving the rest carrying', () => {
    const plate = buildFloorPlate({
      footprint: SQUARE,
      cutouts: STAIR_CUTOUT,
      floorElevation: 103,
    });

    expect(plate).toBeDefined();
    // A hole either splits the ring or becomes an inner ring; either way the
    // cut area is gone from the plate.
    const hasHoleOrSplit =
      (plate?.polygons.length ?? 0) > 1 || (plate?.polygons[0].holes.length ?? 0) > 0;

    expect(hasHoleOrSplit).toBe(true);
  });

  it('reports nothing when the cutout swallows the whole footprint', () => {
    const plate = buildFloorPlate({
      footprint: STAIR_CUTOUT,
      cutouts: SQUARE,
      floorElevation: 103,
    });

    expect(plate).toBeUndefined();
  });
});

describe('buildRoofPlate', () => {
  it('sits the roof slab on top of the ceiling level', () => {
    const plate = buildRoofPlate({
      exposedCeiling: SQUARE,
      cutouts: [],
      ceilingElevation: 105.7,
    });

    expect(plate?.baseElevation).toBe(105.7);
    expect(plate?.topElevation).toBeCloseTo(105.7 + SLAB_THICKNESS_METERS);
  });
});

describe('floorToFloorMeters', () => {
  it('adds the slab to the clear height a stair has to climb', () => {
    expect(floorToFloorMeters(2.7)).toBeCloseTo(2.7 + SLAB_THICKNESS_METERS);
  });
});
