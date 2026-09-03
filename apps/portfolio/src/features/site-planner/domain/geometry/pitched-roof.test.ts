import { describe, expect, it } from 'vitest';

import { createPitchedRoof } from '../model/roofs';
import { multiPolygonArea } from './building-outline';
import {
  defaultRidgeDegrees,
  roofCreases,
  roofFaces,
  roofFrameOf,
  roofHeightAt,
  roofPeakMeters,
  roofPlan,
} from './pitched-roof';
import type { MultiPolygon } from './polygon-types';

/** A 12 × 8 house about the origin — the shape a gable roof is explained on. */
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

const FRAME = roofFrameOf(HOUSE, 0);

function frameOrThrow() {
  if (FRAME === undefined) {
    throw new Error('the house has an outline');
  }

  return FRAME;
}

describe('roofFrameOf', () => {
  it('boxes the outline in the frame the ridge turns to', () => {
    const frame = frameOrThrow();

    expect(frame.center).toEqual({ x: 0, y: 0 });
    expect(frame.alongMeters).toBeCloseTo(12);
    expect(frame.acrossMeters).toBeCloseTo(8);
  });

  it('follows the ridge when it is turned', () => {
    const turned = roofFrameOf(HOUSE, 90);

    expect(turned?.alongMeters).toBeCloseTo(8);
    expect(turned?.acrossMeters).toBeCloseTo(12);
  });
});

describe('defaultRidgeDegrees', () => {
  it('lays the ridge along the longer side', () => {
    expect(defaultRidgeDegrees(HOUSE)).toBe(0);
    expect(defaultRidgeDegrees(roofPlan(HOUSE, 0).map(polygon => ({ ...polygon })))).toBe(0);
  });

  it('turns it a quarter for a house that is deeper than it is wide', () => {
    const deep: MultiPolygon = [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 14 },
          { x: 0, y: 14 },
        ],
        holes: [],
      },
    ];

    expect(defaultRidgeDegrees(deep)).toBe(90);
  });
});

describe('roofPlan', () => {
  it('grows the outline by the overhang', () => {
    expect(multiPolygonArea(roofPlan(HOUSE, 0.5))).toBeCloseTo(13 * 9);
  });

  it('is the outline itself when there is no overhang', () => {
    expect(roofPlan(HOUSE, 0)).toBe(HOUSE);
  });
});

describe('a gable roof', () => {
  const roof = createPitchedRoof({ kind: 'gable', pitchDegrees: 45, overhangMeters: 0 });
  const faces = roofFaces(HOUSE, frameOrThrow(), roof);

  it('is two slopes, each covering half the plan', () => {
    expect(faces).toHaveLength(2);
    expect(multiPolygonArea(faces[0].polygons)).toBeCloseTo(48);
    expect(multiPolygonArea(faces[1].polygons)).toBeCloseTo(48);
  });

  it('stands at the eaves along both long walls and peaks over the ridge', () => {
    const frame = frameOrThrow();
    const heightAt = (x: number, y: number): number =>
      Math.min(...faces.map(face => roofHeightAt(frame, face.plane, { x, y })));

    expect(heightAt(0, 4)).toBeCloseTo(0);
    expect(heightAt(0, -4)).toBeCloseTo(0);
    // 45° over a 4 m half-span: the ridge stands 4 m above the eaves.
    expect(heightAt(0, 0)).toBeCloseTo(4);
    expect(heightAt(0, 2)).toBeCloseTo(2);
    expect(roofPeakMeters(frame, roof)).toBeCloseTo(4);
  });

  it('runs its ridge the length of the house', () => {
    const creases = roofCreases(frameOrThrow(), roof);

    expect(creases).toHaveLength(1);
    expect(creases[0]).toMatchObject({
      isRidge: true,
      from: { x: -6, y: 0 },
      to: { x: 6, y: 0 },
    });
  });
});

describe('a hip roof', () => {
  const roof = createPitchedRoof({ kind: 'hip', pitchDegrees: 45, overhangMeters: 0 });
  const frame = frameOrThrow();
  const faces = roofFaces(HOUSE, frame, roof);

  it('is four slopes that together cover the plan exactly once', () => {
    expect(faces).toHaveLength(4);
    expect(faces.reduce((sum, face) => sum + multiPolygonArea(face.polygons), 0)).toBeCloseTo(96);
  });

  it('peaks over the shortened ridge and falls to every eave', () => {
    const heightAt = (x: number, y: number): number =>
      Math.min(...faces.map(face => roofHeightAt(frame, face.plane, { x, y })));

    expect(heightAt(0, 0)).toBeCloseTo(4);
    expect(heightAt(0, 4)).toBeCloseTo(0);
    expect(heightAt(6, 0)).toBeCloseTo(0);
    // The end slopes climb from the short walls too, unlike a gable's.
    expect(heightAt(5, 0)).toBeCloseTo(1);
  });

  it('shortens the ridge by half the span and hips every corner to it', () => {
    const creases = roofCreases(frame, roof);
    const ridge = creases.filter(crease => crease.isRidge);

    expect(ridge).toHaveLength(1);
    expect(ridge[0].from).toEqual({ x: -2, y: 0 });
    expect(ridge[0].to).toEqual({ x: 2, y: 0 });
    expect(creases.filter(crease => !crease.isRidge)).toHaveLength(4);
  });

  it('collapses to a pyramid over a square house', () => {
    const square: MultiPolygon = [
      {
        outer: [
          { x: -4, y: -4 },
          { x: 4, y: -4 },
          { x: 4, y: 4 },
          { x: -4, y: 4 },
        ],
        holes: [],
      },
    ];
    const squareFrame = roofFrameOf(square, 0);

    if (squareFrame === undefined) {
      throw new Error('the square has an outline');
    }

    const [ridge] = roofCreases(squareFrame, roof);

    expect(ridge.from).toEqual(ridge.to);
    expect(roofFaces(square, squareFrame, roof)).toHaveLength(4);
  });
});

describe('a shed roof', () => {
  const roof = createPitchedRoof({ kind: 'shed', pitchDegrees: 45, overhangMeters: 0 });
  const frame = frameOrThrow();
  const [face] = roofFaces(HOUSE, frame, roof);

  it('is one plane climbing the whole span', () => {
    expect(roofFaces(HOUSE, frame, roof)).toHaveLength(1);
    expect(roofHeightAt(frame, face.plane, { x: 0, y: -4 })).toBeCloseTo(0);
    expect(roofHeightAt(frame, face.plane, { x: 0, y: 4 })).toBeCloseTo(8);
    expect(roofPeakMeters(frame, roof)).toBeCloseTo(8);
  });

  it('has no crease at all', () => {
    expect(roofCreases(frame, roof)).toEqual([]);
  });
});

describe('an L-shaped house', () => {
  const shape: MultiPolygon = [
    {
      outer: [
        { x: -6, y: -4 },
        { x: 6, y: -4 },
        { x: 6, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 4 },
        { x: -6, y: 4 },
      ],
      holes: [],
    },
  ];

  it('gets a roof cut to its own outline rather than to its box', () => {
    const frame = roofFrameOf(shape, 0);

    if (frame === undefined) {
      throw new Error('the L has an outline');
    }

    const faces = roofFaces(shape, frame, createPitchedRoof({ pitchDegrees: 30 }));
    const covered = faces.reduce((sum, face) => sum + multiPolygonArea(face.polygons), 0);

    expect(covered).toBeCloseTo(multiPolygonArea(shape));
  });
});
