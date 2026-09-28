import type { Vector2 } from '@frozik/utils/math/vector2';
import { wrapToHalfTurn } from '@frozik/utils/math/wrapToHalfTurn';
import { isNil } from 'lodash-es';

import type { Direction } from '../domain/types';
import type { TouchZoneSize } from './touch-zone';
import { clampToZone } from './touch-zone';

export const JOYSTICK_DEAD_ZONE_RADIUS_PX = 24;
export const JOYSTICK_REACH_RADIUS_PX = 56;

const QUARTER_TURN_RADIANS = Math.PI / 2;
const HALF_QUADRANT_RADIANS = Math.PI / 4;
const FULL_TURN_RADIANS = Math.PI * 2;
const DIRECTION_HOLD_MARGIN_RADIANS = Math.PI / 15;

/** Quadrants in the order `atan2` sweeps them from +x, with +y pointing down the screen. */
const DIRECTION_BY_QUADRANT: readonly Direction[] = ['right', 'down', 'left', 'up'];

const DIRECTION_ANGLE_RADIANS: Readonly<Record<Direction, number>> = {
  right: 0,
  down: QUARTER_TURN_RADIANS,
  left: Math.PI,
  up: -QUARTER_TURN_RADIANS,
};

export interface JoystickState {
  /** Where the stick stands: the press point, dragged along once the thumb outruns its reach. */
  readonly center: Vector2;
  readonly thumb: Vector2;
  readonly direction: Direction | undefined;
}

export function plantJoystick(point: Vector2): JoystickState {
  return { center: point, thumb: point, direction: undefined };
}

export function tiltJoystick(
  state: JoystickState,
  thumb: Vector2,
  zone: TouchZoneSize
): JoystickState {
  const offset = { x: thumb.x - state.center.x, y: thumb.y - state.center.y };
  const distance = Math.hypot(offset.x, offset.y);

  return {
    center: clampToZone(followThumb(state.center, thumb, offset, distance), zone),
    thumb,
    direction:
      distance < JOYSTICK_DEAD_ZONE_RADIUS_PX
        ? undefined
        : resolveHeldDirection(offset, state.direction),
  };
}

/** Where the knob is drawn: under the thumb, or at the rim once the stick can follow no further. */
export function getKnobOffset({ center, thumb }: JoystickState): Vector2 {
  const offset = { x: thumb.x - center.x, y: thumb.y - center.y };
  const distance = Math.hypot(offset.x, offset.y);

  if (distance <= JOYSTICK_REACH_RADIUS_PX) {
    return offset;
  }

  const reachRatio = JOYSTICK_REACH_RADIUS_PX / distance;

  return { x: offset.x * reachRatio, y: offset.y * reachRatio };
}

/** Without it a long push would have to be travelled all the way back before the tank could reverse. */
function followThumb(center: Vector2, thumb: Vector2, offset: Vector2, distance: number): Vector2 {
  if (distance <= JOYSTICK_REACH_RADIUS_PX) {
    return center;
  }

  const reachRatio = JOYSTICK_REACH_RADIUS_PX / distance;

  return { x: thumb.x - offset.x * reachRatio, y: thumb.y - offset.y * reachRatio };
}

/** A thumb resting near a diagonal would otherwise flip the tank between two directions. */
function resolveHeldDirection(offset: Vector2, held: Direction | undefined): Direction {
  if (!isNil(held)) {
    const drift = Math.abs(
      wrapToHalfTurn(Math.atan2(offset.y, offset.x) - DIRECTION_ANGLE_RADIANS[held])
    );

    if (drift <= HALF_QUADRANT_RADIANS + DIRECTION_HOLD_MARGIN_RADIANS) {
      return held;
    }
  }

  return resolveSectorDirection(offset);
}

/** Rotating the angle by half a quadrant turns the diagonal split into a plain quadrant index. */
function resolveSectorDirection(offset: Vector2): Direction {
  const angle = Math.atan2(offset.y, offset.x) + HALF_QUADRANT_RADIANS;
  const normalizedAngle = ((angle % FULL_TURN_RADIANS) + FULL_TURN_RADIANS) % FULL_TURN_RADIANS;

  return DIRECTION_BY_QUADRANT[Math.floor(normalizedAngle / QUARTER_TURN_RADIANS)];
}
