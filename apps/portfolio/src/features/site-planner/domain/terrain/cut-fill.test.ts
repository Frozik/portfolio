import { describe, expect, it } from 'vitest';

import type { MultiPolygon, Ring } from '../geometry/polygon-types';
import { computeCutFill, computeFootprintElevations, computePadElevation } from './cut-fill';
import type { Heightfield } from './heightfield';

const RESOLUTION = 11;

/** An 11 x 11 grid of one-metre cells over the square [0, 10]². */
function createGrid(elevationAt: (x: number, y: number) => number): Heightfield {
  const heights = new Float32Array(RESOLUTION * RESOLUTION);

  for (let row = 0; row < RESOLUTION; row += 1) {
    for (let column = 0; column < RESOLUTION; column += 1) {
      heights[row * RESOLUTION + column] = elevationAt(column, row);
    }
  }

  return { resolution: RESOLUTION, originMeters: { x: 0, y: 0 }, cellSizeMeters: 1, heights };
}

/** Counter-clockwise, as the boolean fold leaves an outer ring. */
function rectangle(minX: number, minY: number, maxX: number, maxY: number): Ring {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

/** Covers the samples at columns 2 to 6 of rows 2 to 6 — 25 in all. */
const FOOTPRINT: MultiPolygon = [{ outer: rectangle(2, 2, 6, 6), holes: [] }];

describe('computeCutFill', () => {
  it('moves no soil at all on level ground the pad already matches', () => {
    const field = createGrid(() => 4);

    const report = computeCutFill(field, FOOTPRINT, 4);

    expect(report.cutVolumeCubicMeters).toBe(0);
    expect(report.fillVolumeCubicMeters).toBe(0);
  });

  it('balances cut against fill on a slope with the pad at the middle', () => {
    const field = createGrid(column => column);

    const report = computeCutFill(field, FOOTPRINT, 4);

    // Columns 2 to 6 lie 2, 1, 0, -1 and -2 metres from the pad, over five rows.
    expect(report.cutVolumeCubicMeters).toBeCloseTo(15);
    expect(report.fillVolumeCubicMeters).toBeCloseTo(15);
  });

  it('reports cut alone for a pad set below every point of the ground', () => {
    const field = createGrid(() => 5);

    const report = computeCutFill(field, FOOTPRINT, 3);

    // Twenty-five samples, two metres of soil each, one square metre apiece.
    expect(report.cutVolumeCubicMeters).toBeCloseTo(50);
    expect(report.fillVolumeCubicMeters).toBe(0);
  });

  it('reports fill alone for a pad set above every point of the ground', () => {
    const field = createGrid(() => 5);

    const report = computeCutFill(field, FOOTPRINT, 6);

    expect(report.cutVolumeCubicMeters).toBe(0);
    expect(report.fillVolumeCubicMeters).toBeCloseTo(25);
  });

  it('scales the volumes by the ground area one sample stands for', () => {
    const field = createGrid(() => 0);
    const coarse: Heightfield = { ...field, cellSizeMeters: 2 };

    // A two-metre cell covers the plan twice as far, so the footprint spans
    // fewer samples — each of them standing for four square metres.
    const report = computeCutFill(coarse, FOOTPRINT, 1);

    expect(report.fillVolumeCubicMeters).toBeCloseTo(9 * 4);
  });

  it('counts nothing under a footprint that encloses no ground', () => {
    const field = createGrid(() => 5);

    const report = computeCutFill(field, [], 0);

    expect(report.cutVolumeCubicMeters).toBe(0);
    expect(report.fillVolumeCubicMeters).toBe(0);
  });
});

describe('computeFootprintElevations', () => {
  it('reads the centre, the average and the lowest point apart on curved ground', () => {
    const field = createGrid(column => column * column);

    const elevations = computeFootprintElevations(field, FOOTPRINT);

    expect(elevations?.centerElevation).toBeCloseTo(16);
    expect(elevations?.meanElevation).toBeCloseTo((4 + 9 + 16 + 25 + 36) / 5);
    expect(elevations?.minElevation).toBeCloseTo(4);
  });

  it('falls back to the ground under the centroid for a footprint between samples', () => {
    const field = createGrid(column => column);
    const sliver: MultiPolygon = [{ outer: rectangle(2.2, 2.2, 2.4, 2.4), holes: [] }];

    const elevations = computeFootprintElevations(field, sliver);

    expect(elevations?.centerElevation).toBeCloseTo(2.3);
    expect(elevations?.meanElevation).toBeCloseTo(2.3);
    expect(elevations?.minElevation).toBeCloseTo(2.3);
  });

  it('has no ground to read without a footprint', () => {
    expect(
      computeFootprintElevations(
        createGrid(() => 0),
        []
      )
    ).toBeUndefined();
  });
});

describe('computePadElevation', () => {
  const field = createGrid(column => column * column);

  it('follows the ground under the centre in the terrain-center mode', () => {
    const padElevation = computePadElevation({
      field,
      polygons: FOOTPRINT,
      mode: 'terrain-center',
      manualPadElevation: undefined,
    });

    expect(padElevation).toBeCloseTo(16);
  });

  it('averages the ground it covers in the terrain-mean mode', () => {
    const padElevation = computePadElevation({
      field,
      polygons: FOOTPRINT,
      mode: 'terrain-mean',
      manualPadElevation: undefined,
    });

    expect(padElevation).toBeCloseTo((4 + 9 + 16 + 25 + 36) / 5);
  });

  it('sits on the lowest ground it covers in the terrain-min mode', () => {
    const padElevation = computePadElevation({
      field,
      polygons: FOOTPRINT,
      mode: 'terrain-min',
      manualPadElevation: undefined,
    });

    expect(padElevation).toBeCloseTo(4);
  });

  it('takes the typed number in the manual mode', () => {
    const padElevation = computePadElevation({
      field,
      polygons: FOOTPRINT,
      mode: 'manual',
      manualPadElevation: 31.2,
    });

    expect(padElevation).toBe(31.2);
  });

  it('starts a manual pad level with the ground under the centre', () => {
    const padElevation = computePadElevation({
      field,
      polygons: FOOTPRINT,
      mode: 'manual',
      manualPadElevation: undefined,
    });

    expect(padElevation).toBeCloseTo(16);
  });

  it('has no pad without a footprint', () => {
    const padElevation = computePadElevation({
      field,
      polygons: [],
      mode: 'terrain-center',
      manualPadElevation: undefined,
    });

    expect(padElevation).toBeUndefined();
  });
});
