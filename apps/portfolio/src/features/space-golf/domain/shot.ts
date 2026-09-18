import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from './ball';
import { afterStroke } from './bonus';
import {
  AIM_DEAD_ZONE_METERS,
  BAND_SPEED_PER_METER,
  MAX_SPEED_METERS_PER_SECOND,
} from './constants';
import { toggleFloaters } from './floaters';
import type { Level } from './level';
import { toggleSpikes } from './spikes';
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

/** The ball launched: the stroke counts from here, and the spike rows and floaters flip before it moves. */
export function shoot(level: Level, ball: BallState, velocity: Vector2): BallState {
  return {
    ...ball,
    velocity,
    phase: 'flying',
    stroke: ball.stroke + 1,
    contact: undefined,
    settlingSeconds: 0,
    flightSeconds: 0,
    airborneSeconds: 0,
    spikes: toggleSpikes(level, ball.spikes, ball.position),
    floaters: toggleFloaters(level, ball.floaters, ball.position),
    bonus: afterStroke(ball.bonus),
  };
}
