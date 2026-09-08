import type { BallState } from './ball';
import { BALL_RADIUS_METERS, PICKUP_RADIUS_METERS } from './constants';
import type { Level } from './level';
import { distance } from './vector';

const PICKUP_REACH_METERS = BALL_RADIUS_METERS + PICKUP_RADIUS_METERS;

/** The ball with every pickup it is touching added to its collection; the same ball when there is none. */
export function collectPickups(level: Level, ball: BallState): BallState {
  let collected: Set<number> | undefined;
  for (let index = 0; index < level.pickups.length; index += 1) {
    if (ball.collected.has(index)) {
      continue;
    }
    if (distance(ball.position, level.pickups[index].position) <= PICKUP_REACH_METERS) {
      collected ??= new Set(ball.collected);
      collected.add(index);
    }
  }
  return collected === undefined ? ball : { ...ball, collected };
}
