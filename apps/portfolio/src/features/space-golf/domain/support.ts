import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from './ball';
import { distanceToSegment } from './collision';
import { BALL_RADIUS_METERS, CONTACT_EPSILON_METERS } from './constants';
import type { Edge, FaceKind, Level, Segment, Wall } from './level';
import { rodShape } from './rods';
import { touchesBall } from './spikes';
import { distance, dot, subtract } from './vector';

/** A resting ball is kept an epsilon off what it lies on; it still counts as touching within this. */
const TOUCH_SLACK_METERS = 2 * CONTACT_EPSILON_METERS;
const REACH_METERS = BALL_RADIUS_METERS + TOUCH_SLACK_METERS;
/** The faces of an island a ball can lie on the flat of; a deflector is a slope and the cup's rim is the hole. */
const SAFE_FACES: ReadonlySet<FaceKind> = new Set(['floor', 'bounce', 'sticky']);
/** A face's normal is gravity reversed, within this. */
const FACING_TOLERANCE = 1e-6;

/**
 * Whether the ball touches anything at all — a wall, a floater in its
 * current shape or a rod where it stands, a face or a corner, from any
 * side. A ball that does not move and touches something is held by it,
 * whichever way: at rest is at rest, however the ball got there. A ball
 * touching nothing is in the air, however slow.
 */
export function isTouching(level: Level, ball: BallState): boolean {
  const touches = touchOf(ball);
  return (
    level.walls.some(wall => isNear(wall, ball.position) && wall.edges.some(touches)) ||
    level.floaters.some((floater, index) =>
      (ball.floaters[index] ? floater.large : floater.small).edges.some(touches)
    ) ||
    isTouchingRod(level, ball)
  );
}

/**
 * Whether the ball rests somewhere a burst ball can be brought back to: on
 * the flat of an island's face — a horizontal or vertical one, the face
 * gravity presses it to, not a corner of it — with no spike row under it,
 * sunk or not, and no floater or rod touching it. An island stands for as
 * long as the ball is near; a rod goes in and out with gravity on its own,
 * and a ball brought back to a rest on one found it gone, fell, burst and
 * came back again for ever — so whatever can move, change or hurt is no
 * ground to come back to. Such a rest is still a rest: the ball is shot
 * from it like from any other.
 */
export function isSafeRest(level: Level, ball: BallState): boolean {
  const touches = touchOf(ball);
  const onFlatOf = (edge: Edge): boolean => {
    const along = dot(subtract(ball.position, edge.from), edge.direction);
    return (
      SAFE_FACES.has(edge.kind) &&
      dot(edge.normal, ball.down) < -1 + FACING_TOLERANCE &&
      along >= 0 &&
      along <= edge.length &&
      touches(edge)
    );
  };
  return (
    level.walls.some(wall => isNear(wall, ball.position) && wall.edges.some(onFlatOf)) &&
    !level.spikes.some(row => touchesBall(row, ball.position)) &&
    !level.floaters.some((floater, index) =>
      (ball.floaters[index] ? floater.large : floater.small).edges.some(touches)
    ) &&
    !isTouchingRod(level, ball)
  );
}

function isTouchingRod(level: Level, ball: BallState): boolean {
  const touches = touchOf(ball);
  return level.rods.some(
    (rod, index) =>
      ball.rods[index] > 0 &&
      distance(rod.base, ball.position) <= rod.length + REACH_METERS &&
      rodShape(rod, ball.rods[index]).edges.some(touches)
  );
}

function isNear(wall: Wall, point: Vector2): boolean {
  return (
    point.x >= wall.bounds.min.x - REACH_METERS &&
    point.x <= wall.bounds.max.x + REACH_METERS &&
    point.y >= wall.bounds.min.y - REACH_METERS &&
    point.y <= wall.bounds.max.y + REACH_METERS
  );
}

function touchOf(ball: BallState): (segment: Segment) => boolean {
  return segment => distanceToSegment(ball.position, segment) <= REACH_METERS;
}
