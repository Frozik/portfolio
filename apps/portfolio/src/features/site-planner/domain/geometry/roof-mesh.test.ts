import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import type { PitchedRoof } from '../model/roofs';
import { roofFaces, roofFrameOf, roofPeakMeters, roofPlan } from './pitched-roof';
import type { MultiPolygon } from './polygon-types';
import { buildPitchedRoofMesh } from './roof-mesh';

/** A 10 × 6 footprint, ridge along X: the gable ends stand at x = 0 and x = 10. */
const FOOTPRINT: MultiPolygon = [
  {
    outer: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 6 },
      { x: 0, y: 6 },
    ],
    holes: [],
  },
];

const GABLE: PitchedRoof = {
  kind: 'gable',
  pitchDegrees: 30,
  overhangMeters: 0.5,
  ridgeDegrees: 0,
};

const EAVE_ELEVATION = 5;
const ROOF_THICKNESS = 0.18;
const GABLE_END_X = 0;
const POSITION_STRIDE = 3;
const AXIS_EPSILON = 1e-6;

function buildGableMesh() {
  const frame = roofFrameOf(FOOTPRINT, GABLE.ridgeDegrees);

  assert(!isNil(frame), 'a rectangle names a frame');

  const plan = roofPlan(FOOTPRINT, GABLE.overhangMeters);
  const faces = roofFaces(plan, frame, GABLE);

  return {
    frame,
    mesh: buildPitchedRoofMesh({
      faces,
      frame,
      footprint: FOOTPRINT,
      eaveElevation: EAVE_ELEVATION,
      thicknessMeters: ROOF_THICKNESS,
    }),
  };
}

const WALL_TOP = EAVE_ELEVATION - 0.22;

describe('the gable end of a pitched roof', () => {
  it('grows the band from the wall top through the slab belt, not from the eaves', () => {
    const frame = roofFrameOf(FOOTPRINT, GABLE.ridgeDegrees);

    assert(!isNil(frame), 'a rectangle names a frame');

    const plan = roofPlan(FOOTPRINT, GABLE.overhangMeters);
    const mesh = buildPitchedRoofMesh({
      faces: roofFaces(plan, frame, GABLE),
      frame,
      footprint: FOOTPRINT,
      eaveElevation: EAVE_ELEVATION,
      wallTopElevation: WALL_TOP,
      thicknessMeters: ROOF_THICKNESS,
    });

    let lowestOnEnd = Number.POSITIVE_INFINITY;

    for (let index = 0; index < mesh.positions.length; index += POSITION_STRIDE) {
      if (Math.abs(mesh.positions[index] - GABLE_END_X) < AXIS_EPSILON) {
        lowestOnEnd = Math.min(lowestOnEnd, mesh.positions[index + 1]);
      }
    }

    // The masonry datum: one ceiling slab below the eaves. Starting at the
    // eaves left an open slab-tall slit between the gable and its wall.
    expect(lowestOnEnd).toBeCloseTo(WALL_TOP);
  });

  it('closes the wall triangle up to the ridge instead of leaving a hole', () => {
    const { frame, mesh } = buildGableMesh();

    // The tallest vertex ON the end wall must reach the ridge soffit. Before
    // the edge was split where the governing slope changes, both corners of
    // the end edge sat on the eaves, the whole band was skipped, and the
    // house stood open at both ends.
    let tallestOnEnd = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < mesh.positions.length; index += POSITION_STRIDE) {
      if (Math.abs(mesh.positions[index] - GABLE_END_X) < AXIS_EPSILON) {
        tallestOnEnd = Math.max(tallestOnEnd, mesh.positions[index + 1]);
      }
    }

    const ridgeSoffit = EAVE_ELEVATION + roofPeakMeters(frame, GABLE) - ROOF_THICKNESS;

    expect(tallestOnEnd).toBeCloseTo(ridgeSoffit);
  });
});
