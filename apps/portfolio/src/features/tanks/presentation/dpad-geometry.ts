import type { Direction } from '../domain/types';

const QUARTER_TURN_RADIANS = Math.PI / 2;
const HALF_QUADRANT_RADIANS = Math.PI / 4;
const FULL_TURN_RADIANS = Math.PI * 2;

/** Quadrants in the order `atan2` sweeps them from +x, with +y pointing down the screen. */
const DIRECTION_BY_QUADRANT: readonly Direction[] = ['right', 'down', 'left', 'up'];

/**
 * Rotating the pointer angle by half a quadrant turns the corner-ray test into a plain quadrant
 * index; deriving from the live position lets a thumb slide across a diagonal without lifting.
 */
export function resolveDpadDirection(
  offsetXFromCenter: number,
  offsetYFromCenter: number
): Direction {
  const angle = Math.atan2(offsetYFromCenter, offsetXFromCenter) + HALF_QUADRANT_RADIANS;
  const normalizedAngle = ((angle % FULL_TURN_RADIANS) + FULL_TURN_RADIANS) % FULL_TURN_RADIANS;

  return DIRECTION_BY_QUADRANT[Math.floor(normalizedAngle / QUARTER_TURN_RADIANS)];
}
