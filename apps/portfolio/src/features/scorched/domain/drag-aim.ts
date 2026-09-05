import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp } from 'lodash-es';

import { MAX_DIAL_DEGREES, MIN_DIAL_DEGREES } from './aim-dial';
import { MIN_POWER } from './constants';
import type { DragAim } from './scorched-input';

const RADIANS_TO_DEGREES = 180 / Math.PI;

/**
 * [§12.2] How far the finger has to travel from the tank for the throttle to reach the wall. Sized
 * against the 800 × 500 field rather than the screen so the gesture feels the same on every device.
 */
const DRAG_FULL_POWER_DISTANCE_WU = 260;

/**
 * [§12.2] Drag-to-aim: the vector from the active tank to the finger sets the barrel and the
 * throttle in one gesture. A drag below the horizon still aims along it — the barrel cannot point
 * into the ground, so the dial simply clamps at the flat shot instead of the gesture dying.
 */
export function resolveDragAim(dragWu: Vector2, maxPower: number): DragAim {
  const distanceWu = Math.hypot(dragWu.x, dragWu.y);

  return {
    dialDegrees: clamp(
      Math.atan2(dragWu.y, dragWu.x) * RADIANS_TO_DEGREES,
      MIN_DIAL_DEGREES,
      MAX_DIAL_DEGREES
    ),
    power: clamp((distanceWu / DRAG_FULL_POWER_DISTANCE_WU) * maxPower, MIN_POWER, maxPower),
  };
}
