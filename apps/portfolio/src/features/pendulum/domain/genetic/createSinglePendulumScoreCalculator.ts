import { clamp } from 'lodash-es';

import { RAILS_HALF_LENGTH } from '../constants';
import { ANGULAR_VELOCITY_SCALE, BALANCE_CONE } from '../players/observation';
import { MAX_PIVOT_ACCELERATION } from '../players/pivot-control';
import type { IWorld } from '../types';
import { zNormalization } from '../utils';

const BALANCED_CONE = Math.cos(BALANCE_CONE);
/** Speed at which the balance bonus is gone: the rod is swinging through the cone, not held in it. */
const STILLNESS_SCALE = 5 * ANGULAR_VELOCITY_SCALE;
const BALANCE_REWARD = 1;
const OFF_CENTER_PENALTY = 0.5;
const EFFORT_PENALTY = 0.1;

/**
 * Dense shaping for swing-up and balance: the squared height of the bob
 * rewards every bit of energy pumped in, a bonus inside a 15° cone around
 * the upright that grows the stiller the rod is makes holding it there
 * worth more than swinging through, and mild penalties keep the cart centred and its accelerations
 * smooth. Bounded per millisecond, so scores of different robots and runs
 * stay comparable.
 */
export function createSinglePendulumScoreCalculator() {
  let previousPivotVelocity: number | undefined;

  return (world: IWorld, deltaTime: DOMHighResTimeStamp): number => {
    const {
      angles: [angle],
      angularVelocities: [angularVelocity],
      pivotX,
      pivotVelocity,
    } = world;
    const upright = -Math.cos(angle);
    const height = (1 + upright) / 2;
    const effort = clamp(
      (pivotVelocity - (previousPivotVelocity ?? pivotVelocity)) /
        deltaTime /
        MAX_PIVOT_ACCELERATION,
      -1,
      1
    );
    previousPivotVelocity = pivotVelocity;

    const heightReward = height * height;
    const stillness = 1 - Math.abs(zNormalization(angularVelocity, STILLNESS_SCALE));
    const balanceReward = upright >= BALANCED_CONE ? BALANCE_REWARD * stillness : 0;
    const offCenterPenalty = OFF_CENTER_PENALTY * zNormalization(pivotX, RAILS_HALF_LENGTH) ** 2;
    const effortPenalty = EFFORT_PENALTY * effort * effort;

    return (heightReward + balanceReward - offCenterPenalty - effortPenalty) * deltaTime;
  };
}
