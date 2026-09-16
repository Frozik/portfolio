import type { BallState } from './ball';
import { distanceToSegment } from './collision';
import { BALL_RADIUS_METERS, CONTACT_EPSILON_METERS } from './constants';
import type { Level, Segment } from './level';
import { rodShape } from './rods';

/** A resting ball is kept an epsilon off what it lies on; it still counts as touching within this. */
const TOUCH_SLACK_METERS = 2 * CONTACT_EPSILON_METERS;

/**
 * Whether the ball touches anything at all — a wall, a floater in its
 * current shape or a rod where it stands, a face or a corner, from any
 * side. A ball that does not move and touches something is held by it,
 * whichever way: at rest is at rest, however the ball got there. A ball
 * touching nothing is in the air, however slow.
 */
export function isTouching(level: Level, ball: BallState): boolean {
  const reach = BALL_RADIUS_METERS + TOUCH_SLACK_METERS;
  const touches = (segment: Segment): boolean => distanceToSegment(ball.position, segment) <= reach;
  return (
    level.walls.some(wall => wall.edges.some(touches)) ||
    level.floaters.some((floater, index) =>
      (ball.floaters[index] ? floater.large : floater.small).edges.some(touches)
    ) ||
    level.rods.some(
      (rod, index) => ball.rods[index] > 0 && rodShape(rod, ball.rods[index]).edges.some(touches)
    )
  );
}
