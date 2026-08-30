import { describe, expect, it } from 'vitest';

import type {
  CsgOperand,
  CsgOperation,
  CsgTerm,
  Shape,
  ShapeComposition,
  ShapeGroup,
} from '../model/shapes';
import { createCircle, createRectangle, createShapeId } from '../model/shapes';
import {
  evaluateComposition,
  hasRingSelfIntersection,
  MIN_RING_AREA_SQUARE_METERS,
} from './evaluate-composition';
import type { MultiPolygon, Ring } from './polygon-types';
import { CIRCLE_SAGITTA_METERS } from './polygonize-shape';

function compose(...terms: readonly (readonly [CsgOperand, CsgOperation])[]): ShapeComposition {
  return { terms: toTerms(terms) };
}

function group(...terms: readonly (readonly [CsgOperand, CsgOperation])[]): ShapeGroup {
  return { kind: 'group', id: createShapeId(), terms: toTerms(terms) };
}

function toTerms(terms: readonly (readonly [CsgOperand, CsgOperation])[]): readonly CsgTerm[] {
  return terms.map(([operand, operation]) => ({ operand, operation }));
}

function rectangle(
  center: { readonly x: number; readonly y: number },
  width: number,
  length: number
): Shape {
  return createRectangle({ center, width, length, rotationDegrees: 0 });
}

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

function expectValidWinding(polygons: MultiPolygon): void {
  for (const polygon of polygons) {
    expect(signedArea(polygon.outer)).toBeGreaterThan(0);

    for (const hole of polygon.holes) {
      expect(signedArea(hole)).toBeLessThan(0);
    }
  }
}

describe('evaluateComposition', () => {
  it('returns nothing for an empty composition', () => {
    expect(evaluateComposition({ terms: [] })).toEqual([]);
  });

  it('returns nothing when the only term is subtracted', () => {
    const composition = compose([
      createRectangle({ center: { x: 0, y: 0 }, width: 10, length: 10, rotationDegrees: 0 }),
      'subtract',
    ]);

    expect(evaluateComposition(composition)).toEqual([]);
  });

  it('turns a single rectangle into one hole-free polygon', () => {
    const composition = compose([
      createRectangle({ center: { x: 15, y: 20 }, width: 30, length: 40, rotationDegrees: 0 }),
      'union',
    ]);

    const polygons = evaluateComposition(composition);

    expect(polygons).toHaveLength(1);
    expect(polygons[0].holes).toEqual([]);
    expect(polygons[0].outer).toHaveLength(4);
    expect(netArea(polygons)).toBeCloseTo(30 * 40, 6);
    expectValidWinding(polygons);
  });

  it('merges two rectangles sharing a whole edge into a single bridge-free ring', () => {
    const composition = compose(
      [
        createRectangle({ center: { x: 5, y: 5 }, width: 10, length: 10, rotationDegrees: 0 }),
        'union',
      ],
      [
        createRectangle({ center: { x: 15, y: 5 }, width: 10, length: 10, rotationDegrees: 0 }),
        'union',
      ]
    );

    const polygons = evaluateComposition(composition);

    expect(polygons).toHaveLength(1);
    expect(polygons[0].holes).toEqual([]);
    expect(netArea(polygons)).toBeCloseTo(200, 6);
    expectValidWinding(polygons);
    expect(hasRingSelfIntersection(polygons[0].outer)).toBe(false);

    const outerX = polygons[0].outer.map(point => point.x);
    const outerY = polygons[0].outer.map(point => point.y);

    expect(Math.min(...outerX)).toBeCloseTo(0, 6);
    expect(Math.max(...outerX)).toBeCloseTo(20, 6);
    expect(Math.min(...outerY)).toBeCloseTo(0, 6);
    expect(Math.max(...outerY)).toBeCloseTo(10, 6);
  });

  it('merges rectangles sharing only part of an edge into one ring', () => {
    const composition = compose(
      [
        createRectangle({ center: { x: 5, y: 5 }, width: 10, length: 10, rotationDegrees: 0 }),
        'union',
      ],
      [
        createRectangle({ center: { x: 15, y: 5 }, width: 10, length: 4, rotationDegrees: 0 }),
        'union',
      ]
    );

    const polygons = evaluateComposition(composition);

    expect(polygons).toHaveLength(1);
    expect(polygons[0].holes).toEqual([]);
    expect(netArea(polygons)).toBeCloseTo(100 + 40, 6);
    expectValidWinding(polygons);
  });

  it('keeps disjoint unioned rectangles as separate polygons', () => {
    const composition = compose(
      [
        createRectangle({ center: { x: 5, y: 5 }, width: 10, length: 10, rotationDegrees: 0 }),
        'union',
      ],
      [
        createRectangle({ center: { x: 40, y: 5 }, width: 10, length: 10, rotationDegrees: 0 }),
        'union',
      ]
    );

    const polygons = evaluateComposition(composition);

    expect(polygons).toHaveLength(2);
    expect(netArea(polygons)).toBeCloseTo(200, 6);
    expectValidWinding(polygons);
  });

  it('subtracts an inner circle as a hole of the outer ring', () => {
    const radius = 3;
    const composition = compose(
      [
        createRectangle({ center: { x: 15, y: 20 }, width: 30, length: 40, rotationDegrees: 0 }),
        'union',
      ],
      [createCircle({ center: { x: 15, y: 20 }, radius }), 'subtract']
    );

    const polygons = evaluateComposition(composition);

    expect(polygons).toHaveLength(1);
    expect(polygons[0].holes).toHaveLength(1);
    expectValidWinding(polygons);

    const holeArea = Math.abs(signedArea(polygons[0].holes[0]));
    const circleArea = Math.PI * radius * radius;
    const polygonizationLoss = CIRCLE_SAGITTA_METERS * 2 * Math.PI * radius;

    expect(holeArea).toBeLessThan(circleArea);
    expect(holeArea).toBeGreaterThan(circleArea - polygonizationLoss);
    expect(netArea(polygons)).toBeCloseTo(30 * 40 - holeArea, 6);
  });

  it('splits a rectangle into two polygons when a subtraction cuts across it', () => {
    const composition = compose(
      [
        createRectangle({ center: { x: 15, y: 20 }, width: 30, length: 40, rotationDegrees: 0 }),
        'union',
      ],
      [
        createRectangle({ center: { x: 15, y: 20 }, width: 40, length: 4, rotationDegrees: 0 }),
        'subtract',
      ]
    );

    const polygons = evaluateComposition(composition);

    expect(polygons).toHaveLength(2);

    for (const polygon of polygons) {
      expect(polygon.holes).toEqual([]);
      expect(signedArea(polygon.outer)).toBeCloseTo(30 * 18, 6);
    }

    expectValidWinding(polygons);
  });

  it('keeps an island left inside a hole as its own polygon', () => {
    const composition = compose(
      [
        createRectangle({ center: { x: 15, y: 20 }, width: 30, length: 40, rotationDegrees: 0 }),
        'union',
      ],
      [
        createRectangle({ center: { x: 15, y: 20 }, width: 10, length: 10, rotationDegrees: 0 }),
        'subtract',
      ],
      [
        createRectangle({ center: { x: 15, y: 20 }, width: 2, length: 2, rotationDegrees: 0 }),
        'union',
      ]
    );

    const polygons = evaluateComposition(composition);

    expect(polygons).toHaveLength(2);
    expectValidWinding(polygons);
    expect(netArea(polygons)).toBeCloseTo(30 * 40 - 10 * 10 + 2 * 2, 6);
  });

  it('drops rings smaller than the sliver threshold', () => {
    const sliverSide = Math.sqrt(MIN_RING_AREA_SQUARE_METERS) / 2;
    const composition = compose(
      [
        createRectangle({ center: { x: 5, y: 5 }, width: 10, length: 10, rotationDegrees: 0 }),
        'union',
      ],
      [
        createRectangle({
          center: { x: 40, y: 40 },
          width: sliverSide,
          length: sliverSide,
          rotationDegrees: 0,
        }),
        'union',
      ]
    );

    const polygons = evaluateComposition(composition);

    expect(polygons).toHaveLength(1);
    expect(netArea(polygons)).toBeCloseTo(100, 6);
  });

  it('leaves every produced ring free of self-intersections', () => {
    const composition = compose(
      [
        createRectangle({ center: { x: 5, y: 5 }, width: 10, length: 10, rotationDegrees: 0 }),
        'union',
      ],
      [
        createRectangle({ center: { x: 15, y: 5 }, width: 10, length: 10, rotationDegrees: 0 }),
        'union',
      ],
      [
        createRectangle({ center: { x: 10, y: 12 }, width: 6, length: 14, rotationDegrees: 20 }),
        'union',
      ],
      [createCircle({ center: { x: 10, y: 5 }, radius: 2 }), 'subtract']
    );

    for (const polygon of evaluateComposition(composition)) {
      expect(hasRingSelfIntersection(polygon.outer)).toBe(false);

      for (const hole of polygon.holes) {
        expect(hasRingSelfIntersection(hole)).toBe(false);
      }
    }
  });

  it('keeps the hole of a group when that group is unioned with another shape', () => {
    const holeRadius = 2;
    const perforated = group(
      [rectangle({ x: 5, y: 5 }, 10, 10), 'union'],
      [createCircle({ center: { x: 5, y: 5 }, radius: holeRadius }), 'subtract']
    );
    const polygons = evaluateComposition(
      compose([perforated, 'union'], [rectangle({ x: 15, y: 5 }, 10, 10), 'union'])
    );

    expect(polygons).toHaveLength(1);
    expect(polygons[0].holes).toHaveLength(1);
    expectValidWinding(polygons);

    const holeArea = Math.abs(signedArea(polygons[0].holes[0]));

    expect(holeArea).toBeGreaterThan(Math.PI * holeRadius * holeRadius * 0.9);
    expect(netArea(polygons)).toBeCloseTo(200 - holeArea, 6);
  });

  /**
   * The point of the nesting: flattening these three terms would subtract the
   * bite from the plot as well, since a flat fold has no way of confining it to
   * the shape it was drawn against.
   */
  it('subtracts a group as the region it folds to, not as its terms one by one', () => {
    const bittenSquare = group(
      [rectangle({ x: 20, y: 20 }, 10, 10), 'union'],
      [rectangle({ x: 20, y: 20 }, 20, 4), 'subtract']
    );
    const polygons = evaluateComposition(
      compose([rectangle({ x: 20, y: 20 }, 40, 40), 'union'], [bittenSquare, 'subtract'])
    );

    expectValidWinding(polygons);
    expect(netArea(polygons)).toBeCloseTo(40 * 40 - (10 * 10 - 10 * 4), 6);
  });

  it('folds three levels of nesting from the inside out', () => {
    const innermost = group([rectangle({ x: 5, y: 5 }, 4, 4), 'union']);
    const middle = group([rectangle({ x: 5, y: 5 }, 10, 10), 'union'], [innermost, 'subtract']);
    const polygons = evaluateComposition(compose([middle, 'union']));

    expect(polygons).toHaveLength(1);
    expect(polygons[0].holes).toHaveLength(1);
    expect(netArea(polygons)).toBeCloseTo(10 * 10 - 4 * 4, 6);
    expectValidWinding(polygons);
  });

  it('lets an empty group through without disturbing the fold', () => {
    const square = rectangle({ x: 5, y: 5 }, 10, 10);
    const withEmptyGroups = evaluateComposition(
      compose([group(), 'subtract'], [square, 'union'], [group(), 'subtract'], [group(), 'union'])
    );

    expect(netArea(withEmptyGroups)).toBeCloseTo(100, 6);
    expect(withEmptyGroups).toEqual(evaluateComposition(compose([square, 'union'])));
  });

  it('handles a rotated rectangle union without losing area', () => {
    const composition = compose(
      [
        createRectangle({ center: { x: 10, y: 10 }, width: 12, length: 8, rotationDegrees: 30 }),
        'union',
      ],
      [
        createRectangle({ center: { x: 14, y: 12 }, width: 12, length: 8, rotationDegrees: -20 }),
        'union',
      ]
    );

    const polygons = evaluateComposition(composition);

    expect(polygons).toHaveLength(1);
    expectValidWinding(polygons);
    expect(netArea(polygons)).toBeGreaterThan(12 * 8);
    expect(netArea(polygons)).toBeLessThan(2 * 12 * 8);
  });
});

describe('hasRingSelfIntersection', () => {
  it('rejects a bow tie whose opposite edges cross', () => {
    expect(
      hasRingSelfIntersection([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ])
    ).toBe(true);
  });

  it('accepts a simple convex ring', () => {
    expect(
      hasRingSelfIntersection([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ])
    ).toBe(false);
  });

  it('accepts collinear vertices left behind by a union along a shared edge', () => {
    expect(
      hasRingSelfIntersection([
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 0 },
      ])
    ).toBe(false);
  });

  it('accepts a concave ring whose edges only touch at shared vertices', () => {
    expect(
      hasRingSelfIntersection([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 6, y: 10 },
        { x: 6, y: 4 },
        { x: 0, y: 4 },
      ])
    ).toBe(false);
  });

  it('cannot report a crossing for fewer than four vertices', () => {
    expect(
      hasRingSelfIntersection([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ])
    ).toBe(false);
    expect(hasRingSelfIntersection([])).toBe(false);
  });
});
