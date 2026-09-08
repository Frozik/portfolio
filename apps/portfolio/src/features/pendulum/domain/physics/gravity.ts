/** Gravity slider unit: `1` is 0.001 px/ms², a small-angle period of ~2 s on the 100 px rod. */
export const GRAVITY_UNIT = 0.001;

export const DEFAULT_GRAVITY = 1;

export function gravityAcceleration(gravity: number): number {
  return gravity * GRAVITY_UNIT;
}
