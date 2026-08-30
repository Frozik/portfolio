import { describe, expect, it } from 'vitest';

import { createCircle, createRectangle } from '../model/shapes';
import {
  anchorPlanPosition,
  magnetizeAnchor,
  moveShapeByAnchor,
  rotateRectangleAroundAnchor,
  setAnchorPlanPosition,
} from './shape-anchor';

const PRECISION_DIGITS = 9;

function testRectangle() {
  return createRectangle({ center: { x: 10, y: 20 }, width: 6, length: 4, rotationDegrees: 0 });
}

describe('anchorPlanPosition', () => {
  it('reads the centre while no anchor was ever set', () => {
    expect(anchorPlanPosition(testRectangle())).toEqual({ x: 10, y: 20 });
  });

  it('turns with the rectangle', () => {
    const cornered = setAnchorPlanPosition(testRectangle(), { x: 13, y: 22 });
    const rotated = rotateRectangleAroundAnchor(cornered, 90);
    const anchor = anchorPlanPosition(rotated);

    expect(anchor.x).toBeCloseTo(13, PRECISION_DIGITS);
    expect(anchor.y).toBeCloseTo(22, PRECISION_DIGITS);
  });
});

describe('setAnchorPlanPosition', () => {
  it('pins the anchor as extent fractions, so a resize keeps the corner a corner', () => {
    const cornered = setAnchorPlanPosition(testRectangle(), { x: 13, y: 22 });

    expect(cornered.anchorFactors).toEqual({ x: 0.5, y: 0.5 });

    const widened = { ...cornered, width: 12 };

    expect(anchorPlanPosition(widened)).toEqual({ x: 16, y: 22 });
  });

  it('leaves the shape itself untouched', () => {
    const shape = testRectangle();
    const anchored = setAnchorPlanPosition(shape, { x: 7, y: 18 });

    expect(anchored.center).toEqual(shape.center);
    expect(anchored.width).toBe(shape.width);
  });
});

describe('moveShapeByAnchor', () => {
  it('moves the whole shape so the anchor lands on the given point', () => {
    const cornered = setAnchorPlanPosition(testRectangle(), { x: 13, y: 22 });
    const moved = moveShapeByAnchor(cornered, { x: 0, y: 0 });

    expect(anchorPlanPosition(moved)).toEqual({ x: 0, y: 0 });
    expect(moved.center).toEqual({ x: -3, y: -2 });
  });
});

describe('rotateRectangleAroundAnchor', () => {
  it('keeps the anchor put and orbits the centre around it', () => {
    const cornered = setAnchorPlanPosition(testRectangle(), { x: 13, y: 22 });
    const rotated = rotateRectangleAroundAnchor(cornered, 90);

    expect(rotated.rotationDegrees).toBe(90);
    // The centre sat at (-3, -2) from the anchor; a quarter turn CCW puts it at (2, -3).
    expect(rotated.center.x).toBeCloseTo(15, PRECISION_DIGITS);
    expect(rotated.center.y).toBeCloseTo(19, PRECISION_DIGITS);
  });

  it('is the plain rotation while the anchor is the centre', () => {
    const rotated = rotateRectangleAroundAnchor(testRectangle(), 45);

    expect(rotated.center).toEqual({ x: 10, y: 20 });
    expect(rotated.rotationDegrees).toBe(45);
  });
});

describe('magnetizeAnchor', () => {
  it('pulls the point onto a nearby corner', () => {
    expect(magnetizeAnchor(testRectangle(), { x: 12.8, y: 21.9 }, 0.5)).toEqual({ x: 13, y: 22 });
  });

  it('pulls onto the middle of a side', () => {
    expect(magnetizeAnchor(testRectangle(), { x: 10.1, y: 21.95 }, 0.5)).toEqual({ x: 10, y: 22 });
  });

  it('leaves a point beyond the magnet radius alone', () => {
    expect(magnetizeAnchor(testRectangle(), { x: 11.5, y: 21 }, 0.5)).toEqual({ x: 11.5, y: 21 });
  });

  it('offers a circle its centre and the rim cardinals', () => {
    const circle = createCircle({ center: { x: 0, y: 0 }, radius: 2 });

    expect(magnetizeAnchor(circle, { x: 1.9, y: 0.1 }, 0.5)).toEqual({ x: 2, y: 0 });
  });
});
