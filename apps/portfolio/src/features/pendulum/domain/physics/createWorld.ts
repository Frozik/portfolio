import { assert } from '@frozik/utils/assert/assert';
import { clamp } from 'lodash-es';

import { RAILS_HALF_LENGTH } from '../constants';
import type { IPendulumOptions, IWorld } from '../types';

/** The chain starts at rest from the requested rail position, hanging straight down unless an angle is given. */
export function createWorld({
  bobsCount,
  pivotPosition = 0,
  initialAngle = 0,
}: IPendulumOptions): IWorld {
  assert(bobsCount >= 1, 'Bobs count must be at least 1');

  return {
    pivotX: clamp(pivotPosition, -RAILS_HALF_LENGTH, RAILS_HALF_LENGTH),
    pivotVelocity: 0,
    angles: [initialAngle, ...new Array<number>(bobsCount - 1).fill(0)],
    angularVelocities: new Array<number>(bobsCount).fill(0),
  };
}
