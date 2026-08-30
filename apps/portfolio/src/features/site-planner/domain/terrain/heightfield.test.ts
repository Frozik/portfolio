import { describe, expect, it } from 'vitest';

import type { BoundingBox } from '../geometry/bounding-box';
import type { Heightfield } from './heightfield';
import {
  computeElevationRange,
  createHeightfieldForBounds,
  MAX_HEIGHTFIELD_RESOLUTION,
  MIN_HEIGHTFIELD_RESOLUTION,
  sampleHeight,
  samplePosition,
} from './heightfield';

const PLOT_BOUNDS: BoundingBox = { minX: 0, minY: 0, maxX: 30, maxY: 40 };

/** A 2 x 2 grid over a 1 m square, with a corner elevation each. */
function createUnitField(heights: readonly number[]): Heightfield {
  return {
    resolution: 2,
    originMeters: { x: 0, y: 0 },
    cellSizeMeters: 1,
    heights: Float32Array.from(heights),
  };
}

describe('createHeightfieldForBounds', () => {
  it('covers the whole bounding box', () => {
    const field = createHeightfieldForBounds(PLOT_BOUNDS, 64);
    const span = field.cellSizeMeters * (field.resolution - 1);

    expect(field.originMeters).toEqual({ x: PLOT_BOUNDS.minX, y: PLOT_BOUNDS.minY });
    expect(span).toBeGreaterThanOrEqual(PLOT_BOUNDS.maxX - PLOT_BOUNDS.minX);
    expect(span).toBeGreaterThanOrEqual(PLOT_BOUNDS.maxY - PLOT_BOUNDS.minY);
  });

  it('allocates one sample per grid node', () => {
    const field = createHeightfieldForBounds(PLOT_BOUNDS, 16);

    expect(field.resolution).toBe(16);
    expect(field.heights).toHaveLength(16 * 16);
  });

  it('keeps the requested resolution inside the supported range', () => {
    expect(createHeightfieldForBounds(PLOT_BOUNDS, 1).resolution).toBe(MIN_HEIGHTFIELD_RESOLUTION);
    expect(createHeightfieldForBounds(PLOT_BOUNDS, 4096).resolution).toBe(
      MAX_HEIGHTFIELD_RESOLUTION
    );
    expect(createHeightfieldForBounds(PLOT_BOUNDS, Number.NaN).resolution).toBe(
      MIN_HEIGHTFIELD_RESOLUTION
    );
  });

  it('keeps the cell size positive for a plot with no extent', () => {
    const field = createHeightfieldForBounds({ minX: 5, minY: 5, maxX: 5, maxY: 5 }, 8);

    expect(field.cellSizeMeters).toBeGreaterThan(0);
  });
});

describe('samplePosition', () => {
  it('walks the grid from its origin in cell-sized steps', () => {
    const field = createHeightfieldForBounds({ minX: 2, minY: 3, maxX: 6, maxY: 5 }, 5);

    expect(samplePosition(field, 0, 0)).toEqual({ x: 2, y: 3 });
    expect(samplePosition(field, 4, 2)).toEqual({ x: 6, y: 5 });
  });
});

describe('computeElevationRange', () => {
  it('spans the lowest and the highest sample', () => {
    expect(computeElevationRange(createUnitField([-1.5, 0, 2, 3.25]))).toEqual({
      minElevation: -1.5,
      maxElevation: 3.25,
    });
  });

  it('collapses to a single elevation on level terrain', () => {
    expect(computeElevationRange(createUnitField([4, 4, 4, 4]))).toEqual({
      minElevation: 4,
      maxElevation: 4,
    });
  });
});

describe('sampleHeight', () => {
  it('returns the corner values at the grid nodes', () => {
    const field = createUnitField([0, 1, 2, 3]);

    expect(sampleHeight(field, 0, 0)).toBe(0);
    expect(sampleHeight(field, 1, 0)).toBe(1);
    expect(sampleHeight(field, 0, 1)).toBe(2);
    expect(sampleHeight(field, 1, 1)).toBe(3);
  });

  it('interpolates bilinearly inside a cell', () => {
    const field = createUnitField([0, 1, 2, 3]);

    expect(sampleHeight(field, 0.5, 0.5)).toBeCloseTo(1.5, 9);
    expect(sampleHeight(field, 0.25, 0)).toBeCloseTo(0.25, 9);
  });

  it('clamps to the edge outside the grid', () => {
    const field = createUnitField([0, 1, 2, 3]);

    expect(sampleHeight(field, -10, -10)).toBe(0);
    expect(sampleHeight(field, 10, 10)).toBe(3);
    expect(sampleHeight(field, 0.5, 10)).toBeCloseTo(2.5, 9);
  });
});
