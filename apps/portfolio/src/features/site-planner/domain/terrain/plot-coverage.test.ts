import { describe, expect, it } from 'vitest';

import type { MultiPolygon, Ring } from '../geometry/polygon-types';
import type { Heightfield } from './heightfield';
import { buildPlotCoverage } from './plot-coverage';

/** An 11 x 11 grid of one-metre cells over the square [0, 10]². */
function createGrid(): Heightfield {
  return {
    resolution: 11,
    originMeters: { x: 0, y: 0 },
    cellSizeMeters: 1,
    heights: new Float32Array(11 * 11),
  };
}

function coverageAt(field: Heightfield, coverage: Float32Array, column: number, row: number) {
  return coverage[row * field.resolution + column];
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

/** Clockwise, as the boolean fold leaves a hole. */
function reversedRectangle(minX: number, minY: number, maxX: number, maxY: number): Ring {
  return [...rectangle(minX, minY, maxX, maxY)].reverse();
}

describe('buildPlotCoverage', () => {
  it('covers the samples inside the plot and nothing beyond it', () => {
    const field = createGrid();
    const polygons: MultiPolygon = [{ outer: rectangle(2, 2, 6, 6), holes: [] }];

    const coverage = buildPlotCoverage(field, polygons);

    expect(coverageAt(field, coverage, 4, 4)).toBe(1);
    expect(coverageAt(field, coverage, 2, 2)).toBe(1);
    expect(coverageAt(field, coverage, 6, 6)).toBe(1);
    expect(coverageAt(field, coverage, 1, 4)).toBe(0);
    expect(coverageAt(field, coverage, 7, 4)).toBe(0);
    expect(coverageAt(field, coverage, 4, 8)).toBe(0);
  });

  it('covers a boundary running exactly along a row of samples', () => {
    const field = createGrid();
    const polygons: MultiPolygon = [{ outer: rectangle(0, 0, 10, 4), holes: [] }];

    const coverage = buildPlotCoverage(field, polygons);

    expect(coverageAt(field, coverage, 5, 0)).toBe(1);
    expect(coverageAt(field, coverage, 5, 4)).toBe(1);
    expect(coverageAt(field, coverage, 5, 5)).toBe(0);
  });

  it('leaves a hole uncovered', () => {
    const field = createGrid();
    const polygons: MultiPolygon = [
      { outer: rectangle(0, 0, 10, 10), holes: [reversedRectangle(3, 3, 7, 7)] },
    ];

    const coverage = buildPlotCoverage(field, polygons);

    expect(coverageAt(field, coverage, 1, 1)).toBe(1);
    expect(coverageAt(field, coverage, 5, 5)).toBe(0);
    expect(coverageAt(field, coverage, 9, 5)).toBe(1);
  });

  it('covers both parts of a plot split in two', () => {
    const field = createGrid();
    const polygons: MultiPolygon = [
      { outer: rectangle(0, 0, 3, 10), holes: [] },
      { outer: rectangle(7, 0, 10, 10), holes: [] },
    ];

    const coverage = buildPlotCoverage(field, polygons);

    expect(coverageAt(field, coverage, 1, 5)).toBe(1);
    expect(coverageAt(field, coverage, 5, 5)).toBe(0);
    expect(coverageAt(field, coverage, 9, 5)).toBe(1);
  });

  it('covers nothing when the plot evaluates to nothing', () => {
    const field = createGrid();

    expect(buildPlotCoverage(field, []).some(value => value !== 0)).toBe(false);
  });

  it('ignores a plot lying entirely outside the grid', () => {
    const field = createGrid();
    const polygons: MultiPolygon = [{ outer: rectangle(-30, 2, -20, 6), holes: [] }];

    expect(buildPlotCoverage(field, polygons).some(value => value !== 0)).toBe(false);
  });
});
