import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp } from 'lodash-es';

import type { CircleShape, EllipseShape, RectangleShape, Shape } from '../model/shapes';
import type { Meters } from '../units';
import { DEGREES_TO_RADIANS } from '../units';
import type { Ring } from './polygon-types';

/** Largest gap tolerated between the true arc and its chord. */
export const CIRCLE_SAGITTA_METERS: Meters = 0.01;
export const MIN_CIRCLE_SEGMENTS = 16;
export const MAX_CIRCLE_SEGMENTS = 128;

/**
 * Segment count that keeps the sagitta of every chord within
 * {@link CIRCLE_SAGITTA_METERS}: `n = ceil(pi / acos(1 - sagitta / radius))`.
 */
export function countCircleSegments(radius: Meters): number {
  if (radius <= CIRCLE_SAGITTA_METERS) {
    return MIN_CIRCLE_SEGMENTS;
  }

  const segments = Math.ceil(Math.PI / Math.acos(1 - CIRCLE_SAGITTA_METERS / radius));

  return clamp(segments, MIN_CIRCLE_SEGMENTS, MAX_CIRCLE_SEGMENTS);
}

/** Counter-clockwise ring of the shape outline in plan metres. */
export function polygonizeShape(shape: Shape): Ring {
  switch (shape.kind) {
    case 'rectangle':
      return polygonizeRectangle(shape);
    case 'circle':
      return polygonizeCircle(shape);
    case 'ellipse':
      return polygonizeEllipse(shape);
    default:
      return assertNever(shape);
  }
}

/**
 * A frame turned on the plan: where its origin is and how far it is turned
 * counter-clockwise. A rectangle is one; so is a parked car, which is why the
 * rotation below is stated over this rather than over the rectangle itself.
 */
export interface RotatedFrame {
  readonly center: Vector2;
  readonly rotationDegrees: number;
}

/**
 * Maps a point of the frame's own axes — for a rectangle `x` across the width,
 * `y` along the length, origin at the centre — into plan metres. Corners, resize
 * handles and dimension lines all address a rectangle through this one rotation.
 */
export function rectangleLocalToPlan(
  { center, rotationDegrees }: RotatedFrame,
  local: Vector2
): Vector2 {
  const angle = rotationDegrees * DEGREES_TO_RADIANS;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);

  return {
    x: center.x + local.x * cosine - local.y * sine,
    y: center.y + local.x * sine + local.y * cosine,
  };
}

/**
 * Inverse of {@link rectangleLocalToPlan}: plan metres expressed in the
 * rectangle's own frame. Hit testing and resize gestures both reason about a
 * rotated rectangle by undoing its rotation exactly once, here.
 */
export function planToRectangleLocal(
  { center, rotationDegrees }: RotatedFrame,
  point: Vector2
): Vector2 {
  const angle = -rotationDegrees * DEGREES_TO_RADIANS;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const offsetX = point.x - center.x;
  const offsetY = point.y - center.y;

  return {
    x: offsetX * cosine - offsetY * sine,
    y: offsetX * sine + offsetY * cosine,
  };
}

/**
 * The same rotation applied to a direction rather than a point: the rectangle's
 * own axes expressed in plan axes. Handles and dimension lines placed at a fixed
 * pixel offset from an edge take their bearing from here.
 */
export function rectangleLocalDirection(rectangle: RotatedFrame, local: Vector2): Vector2 {
  const point = rectangleLocalToPlan(rectangle, local);

  return { x: point.x - rectangle.center.x, y: point.y - rectangle.center.y };
}

function polygonizeRectangle(rectangle: RectangleShape): Ring {
  const halfWidth = rectangle.width / 2;
  const halfLength = rectangle.length / 2;

  const localCorners: readonly Vector2[] = [
    { x: -halfWidth, y: -halfLength },
    { x: halfWidth, y: -halfLength },
    { x: halfWidth, y: halfLength },
    { x: -halfWidth, y: halfLength },
  ];

  return localCorners.map(local => rectangleLocalToPlan(rectangle, local));
}

/**
 * The ellipse sampled in its own frame and turned with it. The segment count
 * comes from the LONGER semi-axis: that is where the chords sag furthest from
 * the true curve, so counting by it keeps the whole outline within tolerance.
 */
function polygonizeEllipse(ellipse: EllipseShape): Ring {
  const semiWidth = ellipse.width / 2;
  const semiLength = ellipse.length / 2;
  const segments = countCircleSegments(Math.max(semiWidth, semiLength));
  const ring: Vector2[] = [];

  for (let segment = 0; segment < segments; segment += 1) {
    const angle = (2 * Math.PI * segment) / segments;

    ring.push(
      rectangleLocalToPlan(ellipse, {
        x: semiWidth * Math.cos(angle),
        y: semiLength * Math.sin(angle),
      })
    );
  }

  return ring;
}

function polygonizeCircle({ center, radius }: CircleShape): Ring {
  const segments = countCircleSegments(radius);
  const ring: { x: number; y: number }[] = [];

  for (let segment = 0; segment < segments; segment += 1) {
    const angle = (2 * Math.PI * segment) / segments;

    ring.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }

  return ring;
}
