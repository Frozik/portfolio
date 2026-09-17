import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from './ball';
import { afterStroke } from './bonus';
import { sweepCircleAgainstWalls } from './collision';
import {
  AIM_DEAD_ZONE_METERS,
  BALL_RADIUS_METERS,
  BAND_SPEED_PER_METER,
  FORESIGHT_DOTS_PER_LEVEL,
  GRAVITY_METERS_PER_SECOND_SQUARED,
  MAX_SPEED_METERS_PER_SECOND,
  PREVIEW_DOT_COUNT,
  PREVIEW_INTERVAL_SECONDS,
} from './constants';
import { toggleFloaters } from './floaters';
import type { Level } from './level';
import { toggleSpikes } from './spikes';
import { add, clampLength, distance, scale, subtract } from './vector';

/**
 * The launch velocity of a rubber band pulled from `anchor` (where the
 * pointer went down, anywhere on the board) to `pull`: it runs from the pull
 * point back to the anchor, the way a stretched band snaps, capped at the
 * maximum speed. Nothing when the band is slack — the pointer came back to
 * the anchor — so releasing there plays no stroke.
 */
export function aim(anchor: Vector2, pull: Vector2): Vector2 | undefined {
  if (distance(anchor, pull) < AIM_DEAD_ZONE_METERS) {
    return undefined;
  }
  return clampLength(
    scale(subtract(anchor, pull), BAND_SPEED_PER_METER),
    MAX_SPEED_METERS_PER_SECOND
  );
}

/** The ball launched: the stroke counts from here, and the spike rows and floaters flip before it moves. */
export function shoot(level: Level, ball: BallState, velocity: Vector2): BallState {
  return {
    ...ball,
    velocity,
    phase: 'flying',
    stroke: ball.stroke + 1,
    contact: undefined,
    settlingSeconds: 0,
    spikes: toggleSpikes(level, ball.spikes, ball.position),
    floaters: toggleFloaters(level, ball.floaters, ball.position),
    bonus: afterStroke(ball.bonus),
  };
}

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
 * — the dots fall under the gravity the ball rests in, a few more of them
 * with every further bonus, and stop at the first wall in their way: the
 * flight up to its first bounce, no more.
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
  const pull = scale(ball.down, GRAVITY_METERS_PER_SECOND_SQUARED);
  const dots: Vector2[] = [];
  let previous = from;
  for (let index = 1; index <= count; index += 1) {
    const time = index * PREVIEW_INTERVAL_SECONDS;
    const dot = add(add(from, scale(velocity, time)), scale(pull, (time * time) / 2));
    if (sweepCircleAgainstWalls(level.walls, previous, dot, BALL_RADIUS_METERS) !== undefined) {
      break;
    }
    dots.push(dot);
    previous = dot;
  }
  return dots;
}
