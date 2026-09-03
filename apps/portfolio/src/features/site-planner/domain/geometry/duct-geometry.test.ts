import { describe, expect, it } from 'vitest';

import type { VerticalDuct } from '../model/ducts';
import { createDuct } from '../model/ducts';
import { createFireplace } from '../model/fireplaces';
import { createPitchedRoof } from '../model/roofs';
import type { DuctRoofContext } from './duct-geometry';
import { ductTopElevation, fluePosition } from './duct-geometry';
import { roofCreases, roofFaces, roofFrameOf, roofPeakMeters, roofPlan } from './pitched-roof';
import type { MultiPolygon } from './polygon-types';

/** A 12 × 8 house with a 45° gable: eaves at 3 m, ridge 4 m above them. */
const HOUSE: MultiPolygon = [
  {
    outer: [
      { x: -6, y: -4 },
      { x: 6, y: -4 },
      { x: 6, y: 4 },
      { x: -6, y: 4 },
    ],
    holes: [],
  },
];
const ROOF = createPitchedRoof({ kind: 'gable', pitchDegrees: 45, overhangMeters: 0.5 });
const EAVE_ELEVATION = 3;

function roofContext(): DuctRoofContext {
  const frame = roofFrameOf(HOUSE, ROOF.ridgeDegrees);

  if (frame === undefined) {
    throw new Error('the house has an outline');
  }

  return {
    frame,
    faces: roofFaces(roofPlan(HOUSE, ROOF.overhangMeters), frame, ROOF),
    creases: roofCreases(frame, ROOF),
    eaveElevation: EAVE_ELEVATION,
    ridgeElevation: EAVE_ELEVATION + roofPeakMeters(frame, ROOF),
  };
}

function ductAt(x: number, y: number): VerticalDuct {
  return createDuct({ kind: 'flue', position: { x, y } });
}

describe('ductTopElevation', () => {
  const roof = roofContext();

  it('stands half a metre above the ridge when it comes out beside it', () => {
    const top = ductTopElevation({ duct: ductAt(0, 0.5), roof, fallbackElevation: 0 });

    // Ridge at 3 + 4 = 7 m, and СП 7.13130 asks for 0.5 m over it within 1.5 m.
    expect(top).toBeCloseTo(7.5);
  });

  it('comes out level with the ridge between 1.5 and 3 metres from it', () => {
    const top = ductTopElevation({ duct: ductAt(0, 2), roof, fallbackElevation: 0 });

    // The roof under it is at 3 + (4 − 2) = 5 m, so its own clearance is 5.5 m —
    // the ridge rule lifts it to 7 m instead.
    expect(top).toBeCloseTo(7);
  });

  it('clears its own stretch of roof by half a metre further out', () => {
    const top = ductTopElevation({ duct: ductAt(0, 3.5), roof, fallbackElevation: 0 });

    expect(top).toBeCloseTo(EAVE_ELEVATION + 0.5 + 0.5);
  });

  it('rises half a metre over the ceiling when the building has no pitched roof', () => {
    expect(ductTopElevation({ duct: ductAt(0, 0), roof: undefined, fallbackElevation: 6 })).toBe(
      6.5
    );
  });
});

describe('fluePosition', () => {
  it('stands behind the firebox, and turns with the fireplace', () => {
    const facingNorth = createFireplace({
      kind: 'fireplace',
      position: { x: 0, y: 0 },
      rotationDegrees: 0,
    });

    // The body is 0.7 m deep, so the flue sits a quarter of that behind centre.
    expect(fluePosition(facingNorth)).toEqual({ x: 0, y: 0.7 * 0.25 });

    const turned = createFireplace({
      kind: 'fireplace',
      position: { x: 0, y: 0 },
      rotationDegrees: 90,
    });
    const flue = fluePosition(turned);

    expect(flue.x).toBeCloseTo(-0.7 * 0.25);
    expect(flue.y).toBeCloseTo(0);
  });
});
