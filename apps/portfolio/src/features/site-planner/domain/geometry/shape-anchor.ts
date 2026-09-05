import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { BoxedShape, Shape } from '../model/shapes';
import { DEGREES_TO_RADIANS } from '../units';
import { planToRectangleLocal, rectangleLocalToPlan } from './polygonize-shape';

/**
 * The anchor (опорная точка) of a shape: the point its properties speak about
 * and its rotation turns around. Stored as FRACTIONS of the shape's extents in
 * its own frame — a rectangle's corner is `(±0.5, ±0.5)` whatever its size, so
 * resizing never pulls the anchor off the feature it was pinned to. An absent
 * field is the centre, which is what every shape starts with.
 */
const CENTER_ANCHOR: Vector2 = { x: 0, y: 0 };

function anchorFactorsOf(shape: Shape): Vector2 {
  return shape.anchorFactors ?? CENTER_ANCHOR;
}

/** The anchor's offset from the centre in the shape's unrotated frame, metres. */
function anchorLocalOffset(shape: Shape): Vector2 {
  const factors = anchorFactorsOf(shape);

  switch (shape.kind) {
    case 'rectangle':
    case 'ellipse':
      return { x: factors.x * shape.width, y: factors.y * shape.length };
    case 'circle':
      return { x: factors.x * shape.radius, y: factors.y * shape.radius };
    default:
      return assertNever(shape);
  }
}

/** Where the anchor stands on the plan. */
export function anchorPlanPosition(shape: Shape): Vector2 {
  switch (shape.kind) {
    case 'rectangle':
    case 'ellipse':
      return rectangleLocalToPlan(shape, anchorLocalOffset(shape));
    case 'circle': {
      const offset = anchorLocalOffset(shape);

      return { x: shape.center.x + offset.x, y: shape.center.y + offset.y };
    }
    default:
      return assertNever(shape);
  }
}

/**
 * Pins the anchor to a plan point without moving the shape. A degenerate
 * extent would divide the fraction away, so it falls back to the centre.
 */
export function setAnchorPlanPosition<T extends Shape>(shape: T, planPoint: Vector2): T {
  return { ...shape, anchorFactors: computeAnchorFactors(shape, planPoint) };
}

function computeAnchorFactors(shape: Shape, planPoint: Vector2): Vector2 {
  switch (shape.kind) {
    case 'rectangle':
    case 'ellipse': {
      if (shape.width === 0 || shape.length === 0) {
        return CENTER_ANCHOR;
      }

      const local = planToRectangleLocal(shape, planPoint);

      return { x: local.x / shape.width, y: local.y / shape.length };
    }
    case 'circle': {
      if (shape.radius === 0) {
        return CENTER_ANCHOR;
      }

      return {
        x: (planPoint.x - shape.center.x) / shape.radius,
        y: (planPoint.y - shape.center.y) / shape.radius,
      };
    }
    default:
      return assertNever(shape);
  }
}

/** Moves the shape whole so its anchor lands on `planPoint` — the X/Y fields' edit. */
export function moveShapeByAnchor<T extends Shape>(shape: T, planPoint: Vector2): T {
  const anchor = anchorPlanPosition(shape);

  return {
    ...shape,
    center: {
      x: shape.center.x + planPoint.x - anchor.x,
      y: shape.center.y + planPoint.y - anchor.y,
    },
  };
}

/**
 * Turns the rectangle to `rotationDegrees` around its anchor: the anchor's
 * plan position stays put and the centre orbits it, which is what makes the
 * anchor a pivot rather than a caption.
 */
export function rotateRectangleAroundAnchor<T extends BoxedShape>(
  rectangle: T,
  rotationDegrees: number
): T {
  const pivot = anchorPlanPosition(rectangle);
  const offset = anchorLocalOffset(rectangle);
  const radians = rotationDegrees * DEGREES_TO_RADIANS;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);

  return {
    ...rectangle,
    rotationDegrees,
    center: {
      x: pivot.x - (offset.x * cosine - offset.y * sine),
      y: pivot.y - (offset.x * sine + offset.y * cosine),
    },
  };
}

/**
 * The magnetic targets a dragged anchor is caught by: the shape's own special
 * points — a rectangle's corners, the middles of its sides and its centre; a
 * circle's centre and the four points its axes cross the rim at.
 */
function anchorSnapPoints(shape: Shape): readonly Vector2[] {
  switch (shape.kind) {
    // An ellipse offers the same nine: its bounding box's corners and sides
    // are what a drawing is aligned to, exactly as a rectangle's are.
    case 'rectangle':
    case 'ellipse':
      return RECTANGLE_ANCHOR_FACTORS.map(factors =>
        rectangleLocalToPlan(shape, { x: factors.x * shape.width, y: factors.y * shape.length })
      );
    case 'circle':
      return CIRCLE_ANCHOR_FACTORS.map(factors => ({
        x: shape.center.x + factors.x * shape.radius,
        y: shape.center.y + factors.y * shape.radius,
      }));
    default:
      return assertNever(shape);
  }
}

/** The nearest magnetic target within reach, or the point itself. */
export function magnetizeAnchor(shape: Shape, planPoint: Vector2, radiusMeters: number): Vector2 {
  let nearest: Vector2 | undefined;
  let nearestDistance = radiusMeters;

  for (const candidate of anchorSnapPoints(shape)) {
    const distance = Math.hypot(candidate.x - planPoint.x, candidate.y - planPoint.y);

    if (distance <= nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return isNil(nearest) ? planPoint : nearest;
}

const HALF = 0.5;

/** Corners, side middles and the centre, in the rectangle's fractional frame. */
const RECTANGLE_ANCHOR_FACTORS: readonly Vector2[] = [
  { x: -HALF, y: -HALF },
  { x: 0, y: -HALF },
  { x: HALF, y: -HALF },
  { x: HALF, y: 0 },
  { x: HALF, y: HALF },
  { x: 0, y: HALF },
  { x: -HALF, y: HALF },
  { x: -HALF, y: 0 },
  { x: 0, y: 0 },
];

/** The centre and the rim's cardinal points, in radius fractions. */
const CIRCLE_ANCHOR_FACTORS: readonly Vector2[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];
