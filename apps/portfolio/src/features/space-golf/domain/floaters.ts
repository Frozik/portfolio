import type { Vector2 } from '@frozik/utils/math/vector2';

import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Impact } from './collision';
import { reachesPoint, sweepCircleAgainstWall } from './collision';
import {
  BALL_RADIUS_METERS,
  FLOATER_LARGE_SIDE_METERS,
  FLOATER_SMALL_SIDE_METERS,
  FREEZE_CLEARANCE_METERS,
} from './constants';

import type { FaceKind, Floater, FloaterEdgeRef, FloaterShape, Level, Wall } from './level';
import { containsPoint, createWall } from './walls';

export interface FloaterHit extends Impact, FloaterEdgeRef {}

/** A circle is a polygon to the sweep; its corners are rounded by the ball's radius anyway. */
const CIRCLE_SEGMENTS = 24;
const FULL_TURN = Math.PI * 2;

/** A floater at `center`: both of its sizes laid out once, the given shape. */
export function createFloater(
  center: Vector2,
  shape: FloaterShape,
  largeAtStart: boolean
): Floater {
  return {
    center,
    shape,
    largeAtStart,
    small: outline(center, shape, FLOATER_SMALL_SIDE_METERS),
    large: outline(center, shape, FLOATER_LARGE_SIDE_METERS),
  };
}

/** The outline of a shape `size` across — the side of a square, the diameter of a circle — as counter-clockwise vertices. */
function outline(center: Vector2, shape: FloaterShape, size: number): Wall {
  const half = size / 2;
  const vertices = outlineVertices(center, shape, half);
  const kinds = new Map<number, FaceKind>();
  vertices.forEach((_, index) => kinds.set(index, 'floater'));
  return createWall(vertices, kinds);
}

function outlineVertices(center: Vector2, shape: FloaterShape, half: number): Vector2[] {
  switch (shape) {
    case 'square':
      return [
        { x: center.x - half, y: center.y - half },
        { x: center.x + half, y: center.y - half },
        { x: center.x + half, y: center.y + half },
        { x: center.x - half, y: center.y + half },
      ];
    case 'diamond':
      return [
        { x: center.x, y: center.y - half * Math.SQRT2 },
        { x: center.x + half * Math.SQRT2, y: center.y },
        { x: center.x, y: center.y + half * Math.SQRT2 },
        { x: center.x - half * Math.SQRT2, y: center.y },
      ];
    case 'circle': {
      const ring: Vector2[] = [];
      for (let index = 0; index < CIRCLE_SEGMENTS; index += 1) {
        const angle = (index / CIRCLE_SEGMENTS) * FULL_TURN;
        ring.push({ x: center.x + Math.cos(angle) * half, y: center.y + Math.sin(angle) * half });
      }
      return ring;
    }
    default:
      return assertNever(shape);
  }
}

function shapeOf(floater: Floater, large: boolean): Wall {
  return large ? floater.large : floater.small;
}

export function initialFloaters(level: Level): readonly boolean[] {
  return level.floaters.map(floater => floater.largeAtStart);
}

/**
 * The floaters after a stroke is played: every one flips between small and
 * large, except one the ball is touching where it lies, or one that would
 * grow into the ball — that one keeps its shape until the ball has left it.
 */
export function toggleFloaters(
  level: Level,
  large: readonly boolean[],
  ball: Vector2
): readonly boolean[] {
  return level.floaters.map((floater, index) =>
    touchesBall(shapeOf(floater, large[index]), ball) ||
    touchesBall(shapeOf(floater, !large[index]), ball)
      ? large[index]
      : !large[index]
  );
}

/** Whether a shape reaches a ball centred at `ball`, or has it inside. */
function touchesBall(shape: Wall, ball: Vector2): boolean {
  return (
    containsPoint(shape, ball) ||
    reachesPoint(shape.edges, ball, BALL_RADIUS_METERS + FREEZE_CLEARANCE_METERS)
  );
}

/** The earliest floater, in its current shape, the moving circle touches. */
export function sweepCircleAgainstFloaters(
  level: Level,
  large: readonly boolean[],
  from: Vector2,
  to: Vector2,
  radius: number
): FloaterHit | undefined {
  let best: FloaterHit | undefined;
  const { floaters } = level;
  for (let index = 0; index < floaters.length; index += 1) {
    const hit = sweepCircleAgainstWall(shapeOf(floaters[index], large[index]), from, to, radius);
    if (hit !== undefined && (best === undefined || hit.time < best.time)) {
      best = { ...hit, floater: index };
    }
  }
  return best;
}
