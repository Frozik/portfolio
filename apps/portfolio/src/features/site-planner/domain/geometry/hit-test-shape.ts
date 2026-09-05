import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';

import type { CircleShape, EllipseShape, RectangleShape, Shape } from '../model/shapes';
import type { Meters } from '../units';
import type { RotatedFrame } from './polygonize-shape';
import { planToRectangleLocal, polygonizeShape } from './polygonize-shape';
import { distanceToRing } from './segment-distance';

const HALF = 0.5;

/**
 * A turned box on the plan: a frame plus the extents it spans along its own
 * axes. A rectangle shape is one — its width runs along the local `x`, its
 * length along the local `y` — and so is a parked car, whose length runs along
 * the local `x` because that is where its nose points.
 */
export interface RotatedBox extends RotatedFrame {
  readonly extentX: Meters;
  readonly extentY: Meters;
}

/** The box's four corners as a counter-clockwise ring, in plan coordinates. */
export function rotatedBoxRing(box: RotatedBox): readonly Vector2[] {
  const radians = (box.rotationDegrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const halfX = box.extentX * HALF;
  const halfY = box.extentY * HALF;
  const locals: readonly Vector2[] = [
    { x: -halfX, y: -halfY },
    { x: halfX, y: -halfY },
    { x: halfX, y: halfY },
    { x: -halfX, y: halfY },
  ];

  return locals.map(local => ({
    x: box.center.x + local.x * cosine - local.y * sine,
    y: box.center.y + local.x * sine + local.y * cosine,
  }));
}

/** Whether the point falls inside the box, after one inverse rotation. */
function isPointInsideRotatedBox(box: RotatedBox, point: Vector2): boolean {
  const local = planToRectangleLocal(box, point);

  return Math.abs(local.x) <= box.extentX * HALF && Math.abs(local.y) <= box.extentY * HALF;
}

/** Unsigned distance from the point to the box outline, in metres. */
function distanceToRotatedBoxOutline(box: RotatedBox, point: Vector2): Meters {
  const local = planToRectangleLocal(box, point);
  const overshootX = Math.abs(local.x) - box.extentX * HALF;
  const overshootY = Math.abs(local.y) - box.extentY * HALF;
  const outsideDistance = Math.hypot(Math.max(overshootX, 0), Math.max(overshootY, 0));
  const insideDistance = Math.min(Math.max(overshootX, overshootY), 0);

  return Math.abs(outsideDistance + insideDistance);
}

/** Picks the box when the point is inside it or within `toleranceMeters` of its outline. */
export function hitTestRotatedBox(
  box: RotatedBox,
  point: Vector2,
  toleranceMeters: Meters
): boolean {
  return (
    isPointInsideRotatedBox(box, point) ||
    distanceToRotatedBoxOutline(box, point) <= toleranceMeters
  );
}

/**
 * Hit testing runs on the shape parameters rather than on the polygonised ring:
 * a rotated rectangle is exact after one inverse rotation, and a circle needs a
 * single distance, so picking never inherits the polygonisation error.
 */
export function isPointInsideShape(shape: Shape, point: Vector2): boolean {
  switch (shape.kind) {
    case 'rectangle':
      return isPointInsideRotatedBox(rectangleBox(shape), point);
    case 'circle':
      return distanceToCenter(shape, point) <= shape.radius;
    case 'ellipse':
      return isPointInsideEllipse(shape, point);
    default:
      return assertNever(shape);
  }
}

/** Unsigned distance from the point to the shape outline, in metres. */
export function distanceToShapeOutline(shape: Shape, point: Vector2): Meters {
  switch (shape.kind) {
    case 'rectangle':
      return distanceToRotatedBoxOutline(rectangleBox(shape), point);
    case 'circle':
      return Math.abs(distanceToCenter(shape, point) - shape.radius);
    // The exact distance to an ellipse has no closed form; answering with the
    // very ring it is drawn as keeps picking and drawing in agreement.
    case 'ellipse':
      return distanceToRing(polygonizeShape(shape), point);
    default:
      return assertNever(shape);
  }
}

/** Picks the shape when the point is inside it or within `toleranceMeters` of its outline. */
export function hitTestShape(shape: Shape, point: Vector2, toleranceMeters: Meters): boolean {
  return (
    isPointInsideShape(shape, point) || distanceToShapeOutline(shape, point) <= toleranceMeters
  );
}

/** Inside the unit circle its own frame maps it onto — exact, no sampling. */
function isPointInsideEllipse(ellipse: EllipseShape, point: Vector2): boolean {
  const local = planToRectangleLocal(ellipse, point);
  const halfWidth = ellipse.width / 2;
  const halfLength = ellipse.length / 2;

  if (halfWidth === 0 || halfLength === 0) {
    return false;
  }

  return (local.x / halfWidth) ** 2 + (local.y / halfLength) ** 2 <= 1;
}

function rectangleBox({ center, rotationDegrees, width, length }: RectangleShape): RotatedBox {
  return { center, rotationDegrees, extentX: width, extentY: length };
}

function distanceToCenter({ center }: CircleShape, point: Vector2): Meters {
  return Math.hypot(point.x - center.x, point.y - center.y);
}
