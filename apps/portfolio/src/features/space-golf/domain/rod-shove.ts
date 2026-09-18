import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import {
  contactPosition,
  distanceToSegment,
  earlierHit,
  sweepCircleAgainstWalls,
} from './collision';
import { BALL_RADIUS_METERS, CONTACT_EPSILON_METERS, ROD_SHOVE_CARRY_SHARE } from './constants';
import { sweepCircleAgainstFloaters } from './floaters';
import type { Level, Wall } from './level';
import { rodShape, rodVelocity } from './rods';
import { add, distance, dot, length, scale, subtract } from './vector';
import { containsPoint } from './walls';

/** A ball moved less than this by a shove has not been moved: it lies where it lay. */
const MOVED_METERS = 2 * CONTACT_EPSILON_METERS;
/** A ball still this deep in a rod after the shove had nowhere to go: the rod is blocked. */
const BLOCKED_OVERLAP_METERS = CONTACT_EPSILON_METERS;

/** A ball's motion as far as the rods are concerned. */
export interface Motion {
  readonly position: Vector2;
  readonly velocity: Vector2;
}

/** How far every rod stood out before this step, and how far gravity has slid it since. */
export interface RodTravel {
  readonly before: readonly number[];
  readonly now: readonly number[];
}

export interface Shove {
  /** The very motion handed in when no rod has moved the ball. */
  readonly motion: Motion;
  /** How far every rod stands out after all: a blocked rod has not moved. */
  readonly rods: readonly number[];
}

/**
 * The ball shoved clear of any rod that has slid into it: out along the
 * nearest side — off the pointed tip that is sideways — and carried a share
 * as fast as the rod moves. The shove is a motion like any other: a wall or
 * a floater in its way stops it, and the ball slides along that face
 * instead. A shove that ran the ball straight through the face it lay
 * against is how a rod once pushed the ball into an island. A ball with
 * nowhere to go blocks the rod: it stands where it stood until the ball is
 * played away.
 */
export function shoveOutOfRods(
  level: Level,
  travel: RodTravel,
  floaters: readonly boolean[],
  down: Vector2,
  motion: Motion
): Shove {
  let shoved = motion;
  let rods = travel.now;
  level.rods.forEach((rod, index) => {
    const extension = travel.now[index];
    if (extension <= 0 || distance(rod.base, shoved.position) > rod.length + BALL_RADIUS_METERS) {
      return;
    }
    const shape = rodShape(rod, extension);
    const pressed = pressOf(shape, shoved.position);
    if (pressed.overlap <= 0) {
      return;
    }
    const clear = add(
      shoved.position,
      scale(pressed.normal, pressed.overlap + CONTACT_EPSILON_METERS)
    );
    const reached = slideTo(level, floaters, shoved.position, clear);
    const position = distance(reached, shoved.position) > MOVED_METERS ? reached : shoved.position;
    if (pressOf(shape, position).overlap > BLOCKED_OVERLAP_METERS) {
      rods = rods.map((each, at) => (at === index ? travel.before[index] : each));
      shoved = position === shoved.position ? shoved : { ...shoved, position };
      return;
    }
    const along = dot(shoved.velocity, pressed.normal);
    const carried = dot(rodVelocity(rod, extension, down), pressed.normal) * ROD_SHOVE_CARRY_SHARE;
    const velocity =
      along < carried
        ? add(shoved.velocity, scale(pressed.normal, carried - along))
        : shoved.velocity;
    shoved = { position, velocity };
  });
  return { motion: shoved, rods };
}

/** Where a ball pushed from `from` towards `to` gets: all the way, or to what stands in the way and along its face. */
function slideTo(level: Level, floaters: readonly boolean[], from: Vector2, to: Vector2): Vector2 {
  const sweep = (start: Vector2, end: Vector2) =>
    earlierHit(
      sweepCircleAgainstWalls(level.walls, start, end, BALL_RADIUS_METERS),
      sweepCircleAgainstFloaters(level, floaters, start, end, BALL_RADIUS_METERS)
    );
  const hit = sweep(from, to);
  if (isNil(hit)) {
    return to;
  }
  const stopped = contactPosition(from, to, hit, CONTACT_EPSILON_METERS);
  const left = subtract(to, stopped);
  const alongFace = subtract(left, scale(hit.normal, dot(left, hit.normal)));
  if (length(alongFace) <= CONTACT_EPSILON_METERS) {
    return stopped;
  }
  const onwards = add(stopped, alongFace);
  const second = sweep(stopped, onwards);
  return isNil(second)
    ? onwards
    : contactPosition(stopped, onwards, second, CONTACT_EPSILON_METERS);
}

/** How deep the ball at `point` is in the shape, nothing or less when clear of it, and the way out. */
function pressOf(shape: Wall, point: Vector2): { overlap: number; normal: Vector2 } {
  let nearest = { distance: Number.POSITIVE_INFINITY, normal: shape.edges[0].normal };
  for (const edge of shape.edges) {
    const away = distanceToSegment(point, edge);
    if (away < nearest.distance) {
      nearest = { distance: away, normal: edge.normal };
    }
  }
  const depth = containsPoint(shape, point) ? -nearest.distance : nearest.distance;
  return { overlap: BALL_RADIUS_METERS - depth, normal: nearest.normal };
}
