import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import { createCircle, createRectangle } from '../model/shapes';
import { distanceToShapeOutline, hitTestShape, isPointInsideShape } from './hit-test-shape';

const DEGREES_TO_RADIANS = Math.PI / 180;

const ROTATED_RECTANGLE = createRectangle({
  center: { x: 10, y: 20 },
  width: 12,
  length: 4,
  rotationDegrees: 30,
});

/** Maps a point given in the rectangle's own frame into plan coordinates. */
function toPlan(localX: number, localY: number): Vector2 {
  const angle = ROTATED_RECTANGLE.rotationDegrees * DEGREES_TO_RADIANS;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);

  return {
    x: ROTATED_RECTANGLE.center.x + localX * cosine - localY * sine,
    y: ROTATED_RECTANGLE.center.y + localX * sine + localY * cosine,
  };
}

describe('isPointInsideShape for a rotated rectangle', () => {
  it('accepts the centre and interior points', () => {
    expect(isPointInsideShape(ROTATED_RECTANGLE, ROTATED_RECTANGLE.center)).toBe(true);
    expect(isPointInsideShape(ROTATED_RECTANGLE, toPlan(5.5, 1.5))).toBe(true);
    expect(isPointInsideShape(ROTATED_RECTANGLE, toPlan(-5.5, -1.5))).toBe(true);
  });

  it('rejects points beyond the half extents', () => {
    expect(isPointInsideShape(ROTATED_RECTANGLE, toPlan(6.5, 0))).toBe(false);
    expect(isPointInsideShape(ROTATED_RECTANGLE, toPlan(0, 2.5))).toBe(false);
    expect(isPointInsideShape(ROTATED_RECTANGLE, toPlan(6.5, 2.5))).toBe(false);
  });

  it('rejects the point the unrotated rectangle would have contained', () => {
    const axisAlignedInterior = {
      x: ROTATED_RECTANGLE.center.x + 5.5,
      y: ROTATED_RECTANGLE.center.y,
    };

    expect(isPointInsideShape(ROTATED_RECTANGLE, axisAlignedInterior)).toBe(false);
    expect(
      isPointInsideShape(
        createRectangle({ center: { x: 10, y: 20 }, width: 12, length: 4, rotationDegrees: 0 }),
        axisAlignedInterior
      )
    ).toBe(true);
  });

  it('places a point on the outline within a rounding error of the boundary', () => {
    expect(isPointInsideShape(ROTATED_RECTANGLE, toPlan(5.999, 0))).toBe(true);
    expect(isPointInsideShape(ROTATED_RECTANGLE, toPlan(6.001, 0))).toBe(false);
    expect(distanceToShapeOutline(ROTATED_RECTANGLE, toPlan(6, 0))).toBeCloseTo(0, 9);
  });
});

describe('distanceToShapeOutline for a rotated rectangle', () => {
  it('measures the gap to the nearest edge from outside', () => {
    expect(distanceToShapeOutline(ROTATED_RECTANGLE, toPlan(6.5, 0))).toBeCloseTo(0.5, 9);
    expect(distanceToShapeOutline(ROTATED_RECTANGLE, toPlan(0, -3))).toBeCloseTo(1, 9);
  });

  it('measures the diagonal gap past a corner', () => {
    expect(distanceToShapeOutline(ROTATED_RECTANGLE, toPlan(9, 6))).toBeCloseTo(5, 9);
  });

  it('measures the gap to the nearest edge from inside', () => {
    expect(distanceToShapeOutline(ROTATED_RECTANGLE, ROTATED_RECTANGLE.center)).toBeCloseTo(2, 9);
    expect(distanceToShapeOutline(ROTATED_RECTANGLE, toPlan(0, 1.5))).toBeCloseTo(0.5, 9);
  });

  it('is zero on the outline', () => {
    expect(distanceToShapeOutline(ROTATED_RECTANGLE, toPlan(6, 1))).toBeCloseTo(0, 9);
  });
});

describe('circle hit testing', () => {
  const circle = createCircle({ center: { x: -4, y: 7 }, radius: 3 });

  it('accepts points within the radius', () => {
    expect(isPointInsideShape(circle, { x: -4, y: 7 })).toBe(true);
    expect(isPointInsideShape(circle, { x: -4, y: 10 })).toBe(true);
    expect(isPointInsideShape(circle, { x: -4, y: 10.001 })).toBe(false);
  });

  it('measures the distance to the outline on both sides', () => {
    expect(distanceToShapeOutline(circle, { x: -4, y: 7 })).toBeCloseTo(3, 9);
    expect(distanceToShapeOutline(circle, { x: 0, y: 7 })).toBeCloseTo(1, 9);
    expect(distanceToShapeOutline(circle, { x: -2, y: 7 })).toBeCloseTo(1, 9);
  });
});

describe('hitTestShape', () => {
  it('picks a shape the pointer is near but not inside', () => {
    const nearEdge = toPlan(6.2, 0);

    expect(isPointInsideShape(ROTATED_RECTANGLE, nearEdge)).toBe(false);
    expect(hitTestShape(ROTATED_RECTANGLE, nearEdge, 0.3)).toBe(true);
    expect(hitTestShape(ROTATED_RECTANGLE, nearEdge, 0.1)).toBe(false);
  });

  it('picks a shape the pointer is inside regardless of the tolerance', () => {
    expect(hitTestShape(ROTATED_RECTANGLE, ROTATED_RECTANGLE.center, 0)).toBe(true);
  });

  it('applies the tolerance to circles as well', () => {
    const circle = createCircle({ center: { x: 0, y: 0 }, radius: 5 });

    expect(hitTestShape(circle, { x: 5.4, y: 0 }, 0.5)).toBe(true);
    expect(hitTestShape(circle, { x: 5.6, y: 0 }, 0.5)).toBe(false);
  });
});
