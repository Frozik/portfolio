import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from './ball';
import {
  FIXED_STEP_SECONDS,
  FORESIGHT_DOTS_PER_LEVEL,
  PREVIEW_DOT_COUNT,
  PREVIEW_INTERVAL_SECONDS,
} from './constants';
import type { Level } from './level';
import { shoot } from './shot';
import { step } from './step';
import { add, scale } from './vector';

const STEPS_PER_DOT = Math.round(PREVIEW_INTERVAL_SECONDS / FIXED_STEP_SECONDS);

/**
 * Five dots from the ball along the launch velocity, one per fixed
 * interval of it: the impulse the stroke gives, not the flight. The spacing
 * is the speed — a gentle pull packs the dots, a strong one spreads them,
 * past the cap the spacing stops growing. Gravity and walls are left out on
 * purpose: reading how the shot will bend is the player's job.
 */
export function previewDots(from: Vector2, velocity: Vector2): readonly Vector2[] {
  const stride = scale(velocity, PREVIEW_INTERVAL_SECONDS);
  const dots: Vector2[] = [];
  let dot = from;
  for (let index = 0; index < PREVIEW_DOT_COUNT; index += 1) {
    dot = add(dot, stride);
    dots.push(dot);
  }
  return dots;
}

/**
 * What the player is shown of the pending stroke. Without foresight, the
 * straight impulse of `previewDots`. With it — a bonus taken on this level
 * — the flight itself up to its first touch, a few more dots of it with
 * every further bonus. The dots are the stroke played ahead by the game's
 * own `step`, not a formula of their own: a parabola drawn beside the
 * physics left out the air's drag and the step's way of adding gravity up,
 * and the ball flew visibly off the dots it had been promised.
 */
export function previewPath(
  level: Level,
  ball: BallState,
  from: Vector2,
  velocity: Vector2
): readonly Vector2[] {
  if (ball.foresight === 0) {
    return previewDots(from, velocity);
  }
  const count = PREVIEW_DOT_COUNT + (ball.foresight - 1) * FORESIGHT_DOTS_PER_LEVEL;
  const dots: Vector2[] = [];
  let flown = shoot(level, { ...ball, position: from }, velocity);
  while (dots.length < count) {
    for (let tick = 0; tick < STEPS_PER_DOT; tick += 1) {
      flown = step(level, flown, FIXED_STEP_SECONDS);
      // The clock of nothing touched starts over on a touch: the flight is shown up to there.
      if (flown.phase !== 'flying' || flown.airborneSeconds === 0) {
        return dots;
      }
    }
    dots.push(flown.position);
  }
  return dots;
}
