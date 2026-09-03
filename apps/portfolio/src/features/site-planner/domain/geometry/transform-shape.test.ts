import { describe, expect, it } from 'vitest';

import { createCircle, createRectangle } from '../model/shapes';
import {
  fitBoxToDiagonal,
  MIN_SHAPE_EXTENT_METERS,
  moveShape,
  resizeBox,
  rotationDegreesTowards,
  setCircleRadius,
  setRectangleRotation,
} from './transform-shape';

const TOLERANCE = 1e-9;

const RECTANGLE = createRectangle({
  center: { x: 10, y: 20 },
  width: 8,
  length: 12,
  rotationDegrees: 0,
});

const TOP_RIGHT = { widthFactor: 0.5, lengthFactor: 0.5 };
const RIGHT_EDGE = { widthFactor: 0.5, lengthFactor: 0 };

describe('moveShape', () => {
  it('keeps every other parameter of the shape', () => {
    const moved = moveShape(RECTANGLE, { x: 0, y: 0 });

    expect(moved).toEqual({ ...RECTANGLE, center: { x: 0, y: 0 } });
  });

  it('moves a circle by its centre', () => {
    const circle = createCircle({ center: { x: 1, y: 2 }, radius: 3 });

    expect(moveShape(circle, { x: 4, y: 5 })).toEqual({ ...circle, center: { x: 4, y: 5 } });
  });
});

describe('resizeBox', () => {
  it('pins the opposite corner while the grabbed one follows the pointer', () => {
    const resized = resizeBox(RECTANGLE, TOP_RIGHT, { x: 20, y: 30 });

    expect(resized.width).toBeCloseTo(14, 9);
    expect(resized.length).toBeCloseTo(16, 9);
    expect(resized.center.x).toBeCloseTo(13, 9);
    expect(resized.center.y).toBeCloseTo(22, 9);
  });

  it('leaves the untouched axis of an edge handle alone', () => {
    const resized = resizeBox(RECTANGLE, RIGHT_EDGE, { x: 20, y: 30 });

    expect(resized.length).toBe(RECTANGLE.length);
    expect(resized.center.y).toBe(RECTANGLE.center.y);
    expect(resized.width).toBeCloseTo(14, 9);
  });

  it('resizes a rotated rectangle in its own frame', () => {
    const rotated = createRectangle({
      center: { x: 0, y: 0 },
      width: 10,
      length: 4,
      rotationDegrees: 90,
    });
    // Local +x points to plan north once rotated, so the pinned left edge sits
    // at plan y = -5 and dragging to plan y = 10 spans fifteen metres.
    const resized = resizeBox(rotated, RIGHT_EDGE, { x: 0, y: 10 });

    expect(resized.width).toBeCloseTo(15, 9);
    expect(resized.center.x).toBeCloseTo(0, 9);
    expect(resized.center.y).toBeCloseTo(2.5, 9);
  });

  it('never shrinks past the minimum extent', () => {
    const resized = resizeBox(RECTANGLE, TOP_RIGHT, { x: 6, y: 14 });

    expect(resized.width).toBe(MIN_SHAPE_EXTENT_METERS);
    expect(resized.length).toBe(MIN_SHAPE_EXTENT_METERS);
  });
});

describe('fitBoxToDiagonal', () => {
  it('spans the two corners and leaves a degenerate drag empty', () => {
    const spanned = fitBoxToDiagonal(RECTANGLE, { x: 0, y: 0 }, { x: 6, y: -4 });

    expect(spanned).toMatchObject({
      center: { x: 3, y: -2 },
      width: 6,
      length: 4,
      rotationDegrees: 0,
    });
    expect(fitBoxToDiagonal(RECTANGLE, { x: 2, y: 2 }, { x: 2, y: 2 }).width).toBe(0);
  });
});

describe('setRectangleRotation', () => {
  it('wraps the angle into a single turn', () => {
    expect(setRectangleRotation(RECTANGLE, 450).rotationDegrees).toBeCloseTo(90, 9);
    expect(setRectangleRotation(RECTANGLE, -30).rotationDegrees).toBeCloseTo(330, 9);
  });
});

describe('rotationDegreesTowards', () => {
  it('reads zero when the pointer is due north of the centre', () => {
    expect(rotationDegreesTowards({ x: 0, y: 0 }, { x: 0, y: 5 })).toBeCloseTo(0, 9);
  });

  it('turns clockwise on the plan as the pointer swings east', () => {
    expect(rotationDegreesTowards({ x: 0, y: 0 }, { x: 5, y: 0 })).toBeCloseTo(-90, 9);
  });
});

describe('setCircleRadius', () => {
  it('reports the radius it was given, leaving any floor to the caller', () => {
    const circle = createCircle({ center: { x: 0, y: 0 }, radius: 3 });

    expect(setCircleRadius(circle, 0).radius).toBe(0);
    expect(Math.abs(setCircleRadius(circle, 7.5).radius - 7.5)).toBeLessThan(TOLERANCE);
  });
});
