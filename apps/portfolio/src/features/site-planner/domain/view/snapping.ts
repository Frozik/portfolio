import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Meters } from '../units';
import { SCALE_UNITS_PER_METER } from '../units';
import type { PlanModifiers } from './plan-input';

/** A non-positive step means "no snapping" to every snapping helper here. */
export const NO_SNAP_STEP = 0;

const FINE_ROTATION_STEP_DEGREES = 1;
const COARSE_ROTATION_STEP_DEGREES = 15;

/**
 * How coarsely a turn is snapped, for every angle the editor turns by hand: a
 * shape's rotation handle and the needle of the compass dial alike. Alt clears
 * the constraint the way it clears the grid, and Shift takes the step up to the
 * sixteenth of a turn a bearing is normally read at.
 */
export function rotationStepDegrees(modifiers: PlanModifiers): number {
  if (modifiers.isAltPressed) {
    return NO_SNAP_STEP;
  }

  return modifiers.isShiftPressed ? COARSE_ROTATION_STEP_DEGREES : FINE_ROTATION_STEP_DEGREES;
}

/**
 * Rounds a length to the nearest multiple of `stepMeters`. The result is
 * requantised to whole millimetres so that a run of snaps cannot accumulate
 * binary-float dust below the precision the geometry pipeline works at.
 * A non-positive or non-finite step means "no snapping" and passes through.
 */
export function snapLength(value: Meters, stepMeters: Meters): Meters {
  if (!(stepMeters > 0) || !Number.isFinite(stepMeters)) {
    return value;
  }

  const snapped = Math.round(value / stepMeters) * stepMeters;

  return Math.round(snapped * SCALE_UNITS_PER_METER) / SCALE_UNITS_PER_METER;
}

/** Snaps both plan axes independently — the grid is square and axis-aligned. */
export function snapPoint(point: Vector2, stepMeters: Meters): Vector2 {
  return {
    x: snapLength(point.x, stepMeters),
    y: snapLength(point.y, stepMeters),
  };
}
