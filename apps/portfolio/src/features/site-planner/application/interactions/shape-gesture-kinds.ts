import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { anchorPlanPosition } from '../../domain/geometry/shape-anchor';
import type { RectangleHandleFactors } from '../../domain/geometry/transform-shape';
import { rotationDegreesTowards } from '../../domain/geometry/transform-shape';
import type { BoxedShape, CircleShape, Shape } from '../../domain/model/shapes';
import { isBoxedShape } from '../../domain/model/shapes';
import type { Meters } from '../../domain/units';
import type { ShapeHandle } from '../render/plan-draw/draw-selection';
import { rectangleHandleFactors } from '../render/plan-draw/draw-selection';
import { offsetBetween } from './grid-snapping';

/**
 * A drawing gesture smaller than this puts nothing on the plan. It sits above
 * `MIN_SHAPE_EXTENT_METERS` on purpose: a stray click snaps down to that
 * floor, and only a deliberate drag clears this bar.
 */
const MIN_DRAWN_EXTENT_METERS: Meters = 0.2;

/**
 * What the pointer is doing between press and release. Each variant carries the
 * shape as it was when the gesture began, so every move recomputes from that
 * origin instead of accumulating rounding through the snapped intermediates.
 */
export type ShapeGesture<TContext> = { readonly context: TContext } & (
  | { readonly kind: 'move'; readonly startShape: Shape; readonly grabOffset: Vector2 }
  | {
      readonly kind: 'resize';
      readonly startShape: BoxedShape;
      readonly factors: RectangleHandleFactors;
    }
  | {
      readonly kind: 'rotate';
      readonly startShape: BoxedShape;
      /**
       * The pointer's bearing around the anchor at the moment of the grab. The
       * gesture applies the DELTA from it — an absolute reading would snap the
       * shape to wherever the handle happens to lie the instant it is taken,
       * a ~90° jump whenever the anchor is off the centre.
       */
      readonly grabRotationDegrees: number;
    }
  | { readonly kind: 'anchor'; readonly startShape: Shape }
  | { readonly kind: 'resize-radius'; readonly startShape: CircleShape }
  | { readonly kind: 'draw-box'; readonly startShape: BoxedShape; readonly anchor: Vector2 }
  | { readonly kind: 'draw-circle'; readonly startShape: CircleShape; readonly anchor: Vector2 }
);

export type MoveGesture<TContext> = Extract<ShapeGesture<TContext>, { readonly kind: 'move' }>;
/** The two rubber-band gestures; both are steered from an anchor laid down first. */
export type DrawGesture<TContext> = Extract<ShapeGesture<TContext>, { readonly anchor: Vector2 }>;

/** The gesture a grip stands for, or nothing when that grip has no meaning on this shape. */
export function toHandleGesture<TContext>(
  handle: ShapeHandle,
  shape: Shape,
  context: TContext,
  planPoint: Vector2
): ShapeGesture<TContext> | undefined {
  if (handle.kind === 'center') {
    return {
      kind: 'move',
      context,
      startShape: shape,
      grabOffset: offsetBetween(planPoint, shape.center),
    };
  }

  if (handle.kind === 'radius') {
    return shape.kind === 'circle'
      ? { kind: 'resize-radius', context, startShape: shape }
      : undefined;
  }

  if (!isBoxedShape(shape)) {
    return undefined;
  }

  if (handle.kind === 'rotate') {
    return {
      kind: 'rotate',
      context,
      startShape: shape,
      grabRotationDegrees: rotationDegreesTowards(anchorPlanPosition(shape), planPoint),
    };
  }

  const factors = rectangleHandleFactors(handle.kind);

  return isNil(factors) ? undefined : { kind: 'resize', context, startShape: shape, factors };
}

export function isLargeEnoughToKeep(shape: Shape): boolean {
  switch (shape.kind) {
    case 'rectangle':
    case 'ellipse':
      return shape.width >= MIN_DRAWN_EXTENT_METERS && shape.length >= MIN_DRAWN_EXTENT_METERS;
    case 'circle':
      return shape.radius >= MIN_DRAWN_EXTENT_METERS;
    default:
      return assertNever(shape);
  }
}
