import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import { createCircle, createRectangle } from '../model/shapes';
import { getShapeKeyPoints } from './shape-key-points';

const PRECISION_DIGITS = 9;

function expectPointsToBeClose(actual: readonly Vector2[], expected: readonly Vector2[]): void {
  expect(actual).toHaveLength(expected.length);

  actual.forEach((point, index) => {
    expect(point.x).toBeCloseTo(expected[index].x, PRECISION_DIGITS);
    expect(point.y).toBeCloseTo(expected[index].y, PRECISION_DIGITS);
  });
}

describe('getShapeKeyPoints', () => {
  it('gives the four corners of an axis-aligned rectangle and its centre', () => {
    const rectangle = createRectangle({
      center: { x: 10, y: 20 },
      width: 6,
      length: 8,
      rotationDegrees: 0,
    });

    expect(getShapeKeyPoints(rectangle)).toEqual([
      { x: 7, y: 16 },
      { x: 13, y: 16 },
      { x: 13, y: 24 },
      { x: 7, y: 24 },
      { x: 10, y: 20 },
    ]);
  });

  it('turns the corners with the rectangle', () => {
    const rectangle = createRectangle({
      center: { x: 0, y: 0 },
      width: 2,
      length: 4,
      rotationDegrees: 90,
    });

    expectPointsToBeClose(getShapeKeyPoints(rectangle), [
      { x: 2, y: -1 },
      { x: 2, y: 1 },
      { x: -2, y: 1 },
      { x: -2, y: -1 },
      { x: 0, y: 0 },
    ]);
  });

  it('gives a circle nothing but its centre', () => {
    const circle = createCircle({ center: { x: 4, y: 5 }, radius: 3 });

    expect(getShapeKeyPoints(circle)).toEqual([{ x: 4, y: 5 }]);
  });
});
