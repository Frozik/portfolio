import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from './ball';
import {
  AIM_DEAD_ZONE_METERS,
  BAND_SPEED_PER_METER,
  FIXED_STEP_SECONDS,
  MAX_SPEED_METERS_PER_SECOND,
  PREVIEW_DOT_COUNT,
  PREVIEW_INTERVAL_SECONDS,
} from './constants';
import type { Level } from './level';
import { step } from './step';
import { clampLength, distance, scale, subtract } from './vector';

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

/** The ball launched: the stroke counts from here, so the spike rows flip before the flight. */
export function shoot(ball: BallState, velocity: Vector2): BallState {
  return {
    ...ball,
    velocity,
    phase: 'flying',
    stroke: ball.stroke + 1,
    contact: undefined,
    settlingSeconds: 0,
  };
}

/**
 * Five positions of the coming flight at fixed intervals, drawn from the
 * ball: because the intervals are in time, the spacing is the speed — a
 * gentle pull packs the dots, a strong one spreads them, and past the cap the
 * spacing stops growing. Computed with the same `step` as the flight, so the
 * dots bend under gravity and stop where the ball would be destroyed.
 */
export function previewDots(level: Level, ball: BallState, velocity: Vector2): readonly Vector2[] {
  const stepsPerDot = Math.round(PREVIEW_INTERVAL_SECONDS / FIXED_STEP_SECONDS);
  const dots: Vector2[] = [];
  let flight = shoot(ball, velocity);
  for (let dot = 0; dot < PREVIEW_DOT_COUNT; dot += 1) {
    for (let tick = 0; tick < stepsPerDot; tick += 1) {
      flight = step(level, flight, FIXED_STEP_SECONDS);
    }
    dots.push(flight.position);
    if (flight.phase !== 'flying') {
      break;
    }
  }
  return dots;
}
