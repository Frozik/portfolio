import { describe, expect, it } from 'vitest';
import { computeMultiPolygonCentroid } from './polygon-centroid';
import type { MultiPolygon, Ring } from './polygon-types';

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

describe('computeMultiPolygonCentroid', () => {
  it('puts the centroid of a square at its middle', () => {
    const polygons: MultiPolygon = [{ outer: rectangle(0, 0, 10, 10), holes: [] }];

    const centroid = computeMultiPolygonCentroid(polygons);

    expect(centroid?.x).toBeCloseTo(5);
    expect(centroid?.y).toBeCloseTo(5);
  });

  it('keeps a centred hole from moving the centroid', () => {
    const polygons: MultiPolygon = [
      { outer: rectangle(0, 0, 10, 10), holes: [reversedRectangle(4, 4, 6, 6)] },
    ];

    const centroid = computeMultiPolygonCentroid(polygons);

    expect(centroid?.x).toBeCloseTo(5);
    expect(centroid?.y).toBeCloseTo(5);
  });

  it('pulls the centroid towards the larger of two disjoint parts', () => {
    const polygons: MultiPolygon = [
      { outer: rectangle(0, 0, 2, 2), holes: [] },
      { outer: rectangle(10, 0, 14, 2), holes: [] },
    ];

    const centroid = computeMultiPolygonCentroid(polygons);

    // Areas 4 and 8 at x = 1 and x = 12: (4 * 1 + 8 * 12) / 12.
    expect(centroid?.x).toBeCloseTo((4 * 1 + 8 * 12) / 12);
    expect(centroid?.y).toBeCloseTo(1);
  });

  it('places an L-shape centroid inside the material, not in the notch', () => {
    const polygons: MultiPolygon = [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 2 },
          { x: 2, y: 2 },
          { x: 2, y: 4 },
          { x: 0, y: 4 },
        ],
        holes: [],
      },
    ];

    const centroid = computeMultiPolygonCentroid(polygons);

    // Two 2 x 4 and 2 x 2 blocks: (8 * 1 + 4 * 3) / 12 across, mirrored up.
    expect(centroid?.x).toBeCloseTo((8 * 1 + 4 * 3) / 12);
    expect(centroid?.y).toBeCloseTo((8 * 1 + 4 * 3) / 12);
  });

  it('averages the vertices of a figure with no area', () => {
    const polygons: MultiPolygon = [
      {
        outer: [
          { x: 2, y: 4 },
          { x: 6, y: 4 },
        ],
        holes: [],
      },
    ];

    const centroid = computeMultiPolygonCentroid(polygons);

    expect(centroid?.x).toBeCloseTo(4);
    expect(centroid?.y).toBeCloseTo(4);
  });

  it('has nothing to report for an empty figure', () => {
    expect(computeMultiPolygonCentroid([])).toBeUndefined();
  });
});
