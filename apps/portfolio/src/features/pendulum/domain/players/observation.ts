import { RAILS_HALF_LENGTH } from '../constants';
import type { IWorld } from '../types';
import { zNormalization } from '../utils';

/** Half-angle of the cone around the upright in which the rod counts as balanced. */
export const BALANCE_CONE = (15 * Math.PI) / 180;
export const MAX_PIVOT_VELOCITY = 1;

/**
 * Input scales chosen so that the gains of a balancing controller come out
 * near unity, where freshly initialised networks already live and small
 * mutations reach: the lean saturates at the cone's edge, the angular speed
 * at a fifth of a swing-up's, the cart speed at half its limit. Beyond the
 * cone only the signs matter, and those survive saturation.
 */
const LEAN_SCALE = Math.sin(BALANCE_CONE);
export const ANGULAR_VELOCITY_SCALE = 0.001;
const PIVOT_VELOCITY_SCALE = MAX_PIVOT_VELOCITY / 2;

export const OBSERVATION_SIZE = 5;

/**
 * What a robot sees, every value in [−1, 1]: the first rod's lean from the
 * upright and its height (a scaled sine and the cosine, no seam anywhere on
 * the circle), its angular velocity, and the cart's rail position and
 * velocity — the full state of a single pendulum on a velocity-driven cart.
 */
export function observe({
  angles: [angle],
  angularVelocities: [angularVelocity],
  pivotX,
  pivotVelocity,
}: IWorld): readonly number[] {
  return [
    zNormalization(-Math.sin(angle), LEAN_SCALE),
    -Math.cos(angle),
    zNormalization(angularVelocity, ANGULAR_VELOCITY_SCALE),
    zNormalization(pivotX, RAILS_HALF_LENGTH),
    zNormalization(pivotVelocity, PIVOT_VELOCITY_SCALE),
  ];
}
