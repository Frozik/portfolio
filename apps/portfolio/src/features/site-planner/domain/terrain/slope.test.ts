import { describe, expect, it } from 'vitest';

import type { Heightfield } from './heightfield';
import { computeFlowDirection, computeSlopePercent } from './slope';

const RESOLUTION = 5;

/** A 5 x 5 grid of one-metre cells over the square [0, 4]². */
function createGrid(elevationAt: (column: number, row: number) => number): Heightfield {
  const heights = new Float32Array(RESOLUTION * RESOLUTION);

  for (let row = 0; row < RESOLUTION; row += 1) {
    for (let column = 0; column < RESOLUTION; column += 1) {
      heights[row * RESOLUTION + column] = elevationAt(column, row);
    }
  }

  return { resolution: RESOLUTION, originMeters: { x: 0, y: 0 }, cellSizeMeters: 1, heights };
}

describe('computeSlopePercent', () => {
  it('reads no slope at all on level ground', () => {
    const field = createGrid(() => 3.5);

    for (let row = 0; row < RESOLUTION; row += 1) {
      for (let column = 0; column < RESOLUTION; column += 1) {
        expect(computeSlopePercent(field, column, row)).toBe(0);
      }
    }
  });

  it('reads the same steepness everywhere on a plane, borders included', () => {
    // One metre of rise over ten metres of run, laid out east: a 10 % grade.
    const field = createGrid(column => column * 0.1);

    for (let row = 0; row < RESOLUTION; row += 1) {
      for (let column = 0; column < RESOLUTION; column += 1) {
        expect(computeSlopePercent(field, column, row)).toBeCloseTo(10);
      }
    }
  });

  it('combines the two directions of a plane tilted across both axes', () => {
    const field = createGrid((column, row) => column * 0.03 + row * 0.04);

    expect(computeSlopePercent(field, 2, 2)).toBeCloseTo(5);
  });

  it('scales with the cell size the samples stand apart', () => {
    const field = createGrid(column => column * 0.1);
    const coarse: Heightfield = { ...field, cellSizeMeters: 2 };

    // The same rise spread over twice the ground is half as steep.
    expect(computeSlopePercent(coarse, 2, 2)).toBeCloseTo(5);
  });
});

describe('computeFlowDirection', () => {
  it('sends water down the fall line of a plane rising to the east', () => {
    const field = createGrid(column => column);

    expect(computeFlowDirection(field, 2, 2)).toEqual({ columnStep: -1, rowStep: 0 });
  });

  it('sends water south off a plane rising to the north', () => {
    const field = createGrid((_column, row) => row);

    expect(computeFlowDirection(field, 2, 2)).toEqual({ columnStep: 0, rowStep: -1 });
  });

  it('takes the diagonal when the ground falls that way most steeply', () => {
    const field = createGrid((column, row) => column + row);

    expect(computeFlowDirection(field, 2, 2)).toEqual({ columnStep: -1, rowStep: -1 });
  });

  it('leaves level ground without a direction', () => {
    const field = createGrid(() => 2);

    expect(computeFlowDirection(field, 2, 2)).toBeUndefined();
  });

  it('leaves the bottom of a hollow without a direction', () => {
    const field = createGrid((column, row) => (column === 2 && row === 2 ? 0 : 1));

    expect(computeFlowDirection(field, 2, 2)).toBeUndefined();
  });

  it('stays inside the grid at a corner sample the ground falls away from', () => {
    const field = createGrid(column => -column);

    expect(computeFlowDirection(field, 0, 0)).toEqual({ columnStep: 1, rowStep: 0 });
    // The ground keeps falling east past the last column, but there is no
    // sample there — the lowest corner of the grid is where the water stops.
    expect(computeFlowDirection(field, RESOLUTION - 1, 0)).toBeUndefined();
  });
});
