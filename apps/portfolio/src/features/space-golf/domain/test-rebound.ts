import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from './ball';
import { createBall } from './ball';
import { BALL_RADIUS_METERS, FIXED_STEP_SECONDS } from './constants';
import type { Level } from './level';
import { step } from './step';

const RUN_UP_METERS = 0.3;
const MAX_STEPS = 120;

/**
 * Throws the ball square at a point of a face or a corner along its outward
 * normal and reads how fast it leaves the step it bounced — before gravity
 * has had time to bend the rebound.
 */
export function reboundSpeed(
  level: Level,
  target: Vector2,
  outward: Vector2,
  speed: number,
  ball: BallState = createBall(level)
): number {
  const gap = BALL_RADIUS_METERS + RUN_UP_METERS;
  let state: BallState = {
    ...ball,
    phase: 'flying',
    position: { x: target.x + outward.x * gap, y: target.y + outward.y * gap },
    velocity: { x: -outward.x * speed, y: -outward.y * speed },
  };
  for (let tick = 0; tick < MAX_STEPS; tick += 1) {
    const next = step(level, state, FIXED_STEP_SECONDS);
    const away = next.velocity.x * outward.x + next.velocity.y * outward.y;
    if (away > 0) {
      return away;
    }
    state = next;
  }
  return 0;
}
