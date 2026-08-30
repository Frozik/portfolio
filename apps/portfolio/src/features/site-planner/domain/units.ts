/**
 * Every length in the site plan is metres. The alias carries no extra type
 * safety — it documents the unit at the point of use, which is what keeps
 * plan coordinates, radii and elevations from silently mixing scales.
 */
export type Meters = number;

/**
 * Integer scale for the polygon-clipping stage: one unit = one millimetre.
 * A 200 m plot stays far inside the safe integer range while resolving an
 * order of magnitude finer than the ±10 cm accuracy the feature targets.
 */
export const SCALE_UNITS_PER_METER = 1000;

/** Shape rotations, compass offsets and sun azimuths are authored in degrees. */
export const DEGREES_TO_RADIANS = Math.PI / 180;
export const RADIANS_TO_DEGREES = 180 / Math.PI;

export const FULL_TURN_DEGREES = 360;

/**
 * Folds an angle into a single turn, `[0, 360)`. Bearings are periodic, so the
 * same heading can be written down in infinitely many ways; the plan keeps one
 * of them, which is what lets a dial, a typed number and a persisted plan all
 * show the same figure for the same direction.
 */
export function normalizeTurnDegrees(degrees: number): number {
  return ((degrees % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
}
