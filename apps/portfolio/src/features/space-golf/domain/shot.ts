import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from './ball';
import {
  AIM_DEAD_ZONE_METERS,
  BAND_SPEED_PER_METER,
  MAX_SPEED_METERS_PER_SECOND,
  PREVIEW_DOT_COUNT,
  PREVIEW_INTERVAL_SECONDS,
} from './constants';
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

/** The ball launched: the stroke counts from here, and the spike rows flip before it moves. */
export function shoot(level: Level, ball: BallState, velocity: Vector2): BallState {
  return {
    ...ball,
    velocity,
    phase: 'flying',
    stroke: ball.stroke + 1,
    contact: undefined,
    settlingSeconds: 0,
    spikes: toggleSpikes(level, ball.spikes, ball.position),
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
