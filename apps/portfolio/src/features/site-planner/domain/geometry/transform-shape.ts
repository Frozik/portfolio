import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BoxedShape, CircleShape, Shape } from '../model/shapes';
import type { Meters } from '../units';
import { DEGREES_TO_RADIANS } from '../units';
import type { RotatedFrame } from './polygonize-shape';
import { planToRectangleLocal, rectangleLocalToPlan } from './polygonize-shape';

/**
 * Floor of every extent an editing gesture may leave behind: a shape thinner
 * than this cannot be grabbed again, so a resize stops here instead of
 * collapsing the shape out of reach.
 */
export const MIN_SHAPE_EXTENT_METERS: Meters = 0.1;

const FULL_TURN_DEGREES = 360;
const HALF = 0.5;
/** The rotation handle sits on the rectangle's local north, a quarter turn past local east. */
const ROTATION_HANDLE_BEARING_OFFSET_DEGREES = 90;

/**
 * Which side of the rectangle's own frame a resize handle sits on: `±0.5` is an
 * edge, `0` is the middle of the axis and means that dimension is not being
 * dragged. Mirrors the layout the handles are drawn at.
 */
export interface RectangleHandleFactors {
  readonly widthFactor: number;
  readonly lengthFactor: number;
}

export function moveShape(shape: Shape, center: Vector2): Shape {
  switch (shape.kind) {
    case 'rectangle':
    case 'circle':
    case 'ellipse':
      return { ...shape, center };
    default:
      return assertNever(shape);
  }
}

/**
 * A rotated rectangle as a resize gesture sees it: the frame and its extents.
 * Stated structurally so everything box-shaped on the plan — a drawn shape, a
 * floor slab — is resized by the same gesture rather than by a copy of it.
 */
export interface RotatedRectangle extends RotatedFrame {
  readonly width: Meters;
  readonly length: Meters;
}

export function resizeBox<T extends BoxedShape>(
  shape: T,
  factors: RectangleHandleFactors,
  cornerPoint: Vector2
): T {
  return { ...shape, ...resizeRotatedRectangle(shape, factors, cornerPoint) };
}

/**
 * Drags one handle of a rectangle while the opposite side stays pinned, so the
 * gesture reads as a resize rather than a move. Dragging past the pinned side
 * flips the rectangle over it instead of jamming, and the rotation is preserved
 * because the whole computation happens in the rectangle's own frame.
 */
function resizeRotatedRectangle(
  rectangle: RotatedRectangle,
  factors: RectangleHandleFactors,
  cornerPoint: Vector2
): RotatedRectangle {
  const anchorLocal: Vector2 = {
    x: -factors.widthFactor * rectangle.width,
    y: -factors.lengthFactor * rectangle.length,
  };
  const pointerLocal = planToRectangleLocal(rectangle, cornerPoint);
  const width = resolveExtent(rectangle.width, factors.widthFactor, anchorLocal.x, pointerLocal.x);
  const length = resolveExtent(
    rectangle.length,
    factors.lengthFactor,
    anchorLocal.y,
    pointerLocal.y
  );

  return {
    ...rectangle,
    width,
    length,
    center: rectangleLocalToPlan(rectangle, {
      x: resolveCenterOffset(factors.widthFactor, anchorLocal.x, pointerLocal.x, width),
      y: resolveCenterOffset(factors.lengthFactor, anchorLocal.y, pointerLocal.y, length),
    }),
  };
}

/**
 * Rubber-band rectangle spanning two opposite corners. Extents are left raw —
 * a gesture that never moved has to stay recognisably empty so the caller can
 * discard it instead of dropping a sliver on the plan.
 */
export function fitBoxToDiagonal<T extends BoxedShape>(
  rectangle: T,
  anchor: Vector2,
  corner: Vector2
): T {
  return {
    ...rectangle,
    center: { x: (anchor.x + corner.x) / 2, y: (anchor.y + corner.y) / 2 },
    width: Math.abs(corner.x - anchor.x),
    length: Math.abs(corner.y - anchor.y),
    rotationDegrees: 0,
  };
}

/** Wraps into `[0, 360)` so a rotation readout never shows an accumulated turn count. */
export function setRectangleRotation<T extends BoxedShape>(
  rectangle: T,
  rotationDegrees: number
): T {
  return {
    ...rectangle,
    rotationDegrees:
      ((rotationDegrees % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES,
  };
}

/** Raw radius: the minimum is the caller's policy, as it is for a drawn rectangle. */
export function setCircleRadius(circle: CircleShape, radius: Meters): CircleShape {
  return { ...circle, radius };
}

/**
 * Rotation a turned frame needs so that its local east — a car's nose — points
 * at `point`. It is the plain bearing from the centre, which is what a car is
 * turned by; a rectangle's own handle stands a quarter turn off it.
 */
export function bearingDegreesTowards(center: Vector2, point: Vector2): number {
  return Math.atan2(point.y - center.y, point.x - center.x) / DEGREES_TO_RADIANS;
}

/**
 * Rotation a rectangle needs so that its local north points at `point`. The
 * quarter-turn offset is what ties the angle to the rotation handle the user is
 * actually holding rather than to the local east axis `atan2` reports.
 */
export function rotationDegreesTowards(center: Vector2, point: Vector2): number {
  return bearingDegreesTowards(center, point) - ROTATION_HANDLE_BEARING_OFFSET_DEGREES;
}

function resolveExtent(
  currentExtent: Meters,
  factor: number,
  anchorLocal: number,
  pointerLocal: number
): Meters {
  if (factor === 0) {
    return currentExtent;
  }

  return Math.max(Math.abs(pointerLocal - anchorLocal), MIN_SHAPE_EXTENT_METERS);
}

/** Offset of the resized centre from the current one, along one local axis. */
function resolveCenterOffset(
  factor: number,
  anchorLocal: number,
  pointerLocal: number,
  extent: Meters
): number {
  if (factor === 0) {
    return 0;
  }

  const direction = pointerLocal >= anchorLocal ? 1 : -1;

  return anchorLocal + direction * extent * HALF;
}
