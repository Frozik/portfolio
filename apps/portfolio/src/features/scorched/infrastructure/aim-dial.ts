import { clamp } from 'lodash-es';

import { MAX_ELEVATION_DEGREES, MIN_ELEVATION_DEGREES } from '../domain/constants';
import type { AimState, TurretFacing } from '../domain/types';

/**
 * The domain models aim as a facing side plus a 0–90° elevation [MANUAL §5], but a player sweeps
 * the barrel with a single pair of arrow keys. This is the dial they turn: 0° points straight
 * right, 90° straight up, 180° straight left, and the facing flip at the top is invisible to them.
 */
export const MIN_DIAL_DEGREES = 0;
const STRAIGHT_UP_DIAL_DEGREES = 90;
export const MAX_DIAL_DEGREES = 180;

export interface DialAim {
  readonly facing: TurretFacing;
  readonly elevationDegrees: number;
}

export function toDialDegrees(aim: DialAim): number {
  const elevation = clamp(aim.elevationDegrees, MIN_ELEVATION_DEGREES, MAX_ELEVATION_DEGREES);

  return aim.facing === 'right' ? elevation : MAX_DIAL_DEGREES - elevation;
}

export function fromDialDegrees(dialDegrees: number): DialAim {
  const dial = clamp(dialDegrees, MIN_DIAL_DEGREES, MAX_DIAL_DEGREES);

  return dial <= STRAIGHT_UP_DIAL_DEGREES
    ? { facing: 'right', elevationDegrees: dial }
    : { facing: 'left', elevationDegrees: MAX_DIAL_DEGREES - dial };
}

/** Turns the dial by `deltaDegrees`, keeping the power the domain already clamped. */
export function turnDial(aim: AimState, deltaDegrees: number): AimState {
  const turned = fromDialDegrees(toDialDegrees(aim) + deltaDegrees);

  return { ...turned, power: aim.power };
}
