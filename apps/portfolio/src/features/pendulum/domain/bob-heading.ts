import { wrapToHalfTurn } from '@frozik/utils/math/wrapToHalfTurn';

import type { IWorld } from './types';

const QUARTER_TURN = Math.PI / 2;

/**
 * The first bob's direction as the networks learnt to read it, kept from the
 * original `atan2` over canvas coordinates: −π/2 hanging down, +π/2 balanced
 * upright, 0 pointing left, ±π pointing right. Positive means above the pivot.
 */
export function firstBobHeading({ angles: [angle] }: IWorld): number {
  return wrapToHalfTurn(-angle - QUARTER_TURN);
}
