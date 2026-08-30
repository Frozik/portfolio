import { describe, expect, it } from 'vitest';

import { createCircle, createRectangle } from '../model/shapes';
import { evaluateComposition } from './evaluate-composition';
import { buildPathRibbon, buildVariableWidthRibbon, offsetPolygons } from './offset-polygon';
import type { MultiPolygon, Ring } from './polygon-types';

function signedArea(ring: Ring): number {
  let doubledArea = 0;

  ring.forEach((point, index) => {
    const next = ring[(index + 1) % ring.length];

    doubledArea += point.x * next.y - next.x * point.y;
  });

  return doubledArea / 2;
}

function netArea(polygons: MultiPolygon): number {
  return polygons.reduce(
    (total, polygon) =>
      total +
      signedArea(polygon.outer) +
      polygon.holes.reduce((holeTotal, hole) => holeTotal + signedArea(hole), 0),
    0
  );
}

function ringBounds(ring: Ring): { width: number; height: number } {
  const xs = ring.map(point => point.x);
  const ys = ring.map(point => point.y);

  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function plotOf(width: number, length: number): MultiPolygon {
  return evaluateComposition({
    terms: [
      {
        operand: createRectangle({
          center: { x: width / 2, y: length / 2 },
          width,
          length,
          rotationDegrees: 0,
        }),
        operation: 'union',
      },
    ],
  });
}

describe('offsetPolygons', () => {
  it('shrinks a 30 x 40 plot to 24 x 34 at a 3 m setback', () => {
    const setback = offsetPolygons(plotOf(30, 40), -3);

    expect(setback).toHaveLength(1);
    expect(setback[0].holes).toEqual([]);

    const bounds = ringBounds(setback[0].outer);

    expect(bounds.width).toBeCloseTo(24, 6);
    expect(bounds.height).toBeCloseTo(34, 6);
    expect(netArea(setback)).toBeCloseTo(24 * 34, 6);
  });

  it('keeps the outer ring counter-clockwise after offsetting', () => {
    const setback = offsetPolygons(plotOf(30, 40), -2);

    expect(signedArea(setback[0].outer)).toBeGreaterThan(0);
    expect(netArea(setback)).toBeCloseTo(26 * 36, 6);
  });

  it('grows the plot when the offset is positive', () => {
    const grown = offsetPolygons(plotOf(30, 40), 2);

    expect(netArea(grown)).toBeCloseTo(34 * 44, 6);
  });

  it('widens holes inwards so the setback stays inside the material', () => {
    const holed = evaluateComposition({
      terms: [
        {
          operand: createRectangle({
            center: { x: 15, y: 20 },
            width: 30,
            length: 40,
            rotationDegrees: 0,
          }),
          operation: 'union',
        },
        { operand: createCircle({ center: { x: 15, y: 20 }, radius: 5 }), operation: 'subtract' },
      ],
    });

    const setback = offsetPolygons(holed, -2);

    expect(setback).toHaveLength(1);
    expect(setback[0].holes).toHaveLength(1);
    expect(Math.abs(signedArea(setback[0].holes[0]))).toBeGreaterThan(
      Math.abs(signedArea(holed[0].holes[0]))
    );
    expect(signedArea(setback[0].holes[0])).toBeLessThan(0);
  });

  it('returns the input untouched for a zero offset', () => {
    const plot = plotOf(30, 40);

    expect(offsetPolygons(plot, 0)).toBe(plot);
  });

  it('returns nothing when the setback consumes the whole plot', () => {
    expect(offsetPolygons(plotOf(4, 4), -3)).toEqual([]);
  });

  it('returns nothing for an empty input', () => {
    expect(offsetPolygons([], -3)).toEqual([]);
  });
});

describe('buildPathRibbon', () => {
  it('turns a straight polyline into a closed ribbon of length times width', () => {
    const length = 10;
    const width = 2;
    const ribbon = buildPathRibbon(
      [
        { x: 0, y: 0 },
        { x: length, y: 0 },
      ],
      width
    );

    expect(ribbon).toHaveLength(1);
    expect(ribbon[0].holes).toEqual([]);
    expect(signedArea(ribbon[0].outer)).toBeGreaterThan(0);

    const radius = width / 2;
    const expectedArea = length * width + Math.PI * radius * radius;

    expect(netArea(ribbon)).toBeGreaterThan(length * width);
    expect(netArea(ribbon)).toBeCloseTo(expectedArea, 1);

    const bounds = ringBounds(ribbon[0].outer);

    expect(bounds.width).toBeCloseTo(length + width, 1);
    expect(bounds.height).toBeCloseTo(width, 1);
  });

  it('keeps a bent polyline in a single ring', () => {
    const ribbon = buildPathRibbon(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      2
    );

    expect(ribbon).toHaveLength(1);
    expect(ribbon[0].holes).toEqual([]);
    expect(netArea(ribbon)).toBeGreaterThan(20 * 2);
  });

  it('returns nothing for a degenerate polyline or width', () => {
    expect(buildPathRibbon([], 2)).toEqual([]);
    expect(buildPathRibbon([{ x: 0, y: 0 }], 2)).toEqual([]);
    expect(
      buildPathRibbon(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        0
      )
    ).toEqual([]);
  });
});

describe('buildVariableWidthRibbon', () => {
  it('unions the trapezoid with its end discs whichever way the segment runs', () => {
    // The trapezoid's drawn winding flips with the direction of travel; under
    // the non-zero union a clockwise ring would CANCEL the discs it overlaps
    // — the very bug that painted holes into the caps. Both directions must
    // yield the same solid ribbon.
    const forward = buildVariableWidthRibbon([
      { position: { x: 0, y: 0 }, width: 1 },
      { position: { x: 4, y: 0 }, width: 2 },
    ]);
    const backward = buildVariableWidthRibbon([
      { position: { x: 4, y: 0 }, width: 2 },
      { position: { x: 0, y: 0 }, width: 1 },
    ]);

    // Trapezoid 4 × (1+2)/2 plus the two half-discs sticking past the ends.
    const expectedArea = 6 + (Math.PI * (0.5 * 0.5 + 1 * 1)) / 2;

    expect(netArea(forward)).toBeCloseTo(expectedArea, 1);
    expect(netArea(backward)).toBeCloseTo(expectedArea, 1);
    // One solid piece, no cancelled wedges inside.
    expect(forward).toHaveLength(1);
    expect(forward[0].holes).toEqual([]);
  });
});
