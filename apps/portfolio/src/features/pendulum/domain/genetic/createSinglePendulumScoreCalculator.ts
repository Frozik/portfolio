import { clamp } from 'lodash-es';

import { firstBobHeading } from '../bob-heading';
import { RAILS_HALF_LENGTH } from '../constants';
import { bobVelocities } from '../physics/kinematics';
import type { IWorld } from '../types';
import { zNormalization } from '../utils';

interface ITopContext {
  positiveTime: DOMHighResTimeStamp;
  negativeTime: DOMHighResTimeStamp;
  jitterDetector: number[];
}

// Bob speed (px/ms) at which the velocity bonus is gone and the action bonus is full.
const MAX_TRACKED_VELOCITY = 0.6;
// Number of recent normalized positions kept to detect oscillation (jitter).
const JITTER_WINDOW_SIZE = 50;
// Normalized-position band around the rail center treated as "on target".
const CENTER_POSITION_THRESHOLD = 0.1;
// Normalized-position band beyond which the cart is penalized for drifting.
const OFF_CENTER_POSITION_THRESHOLD = 0.2;

// Time-based reward shaping: dampened vs. linear accumulation of upright time.
const DAMPENED_TIME_DIVISOR = 800;
const LINEAR_TIME_DIVISOR = 50;
// Bonus for holding upright while keeping the cart still (few direction changes).
const STEADINESS_TIME_DIVISOR = 20;
const MAX_STEADINESS_DIRECTION_CHANGES = 5;

// Multipliers turning raw measures into score contributions.
const CENTERING_BONUS_WEIGHT = 10;
const VELOCITY_BONUS_WEIGHT = 100;
const ACTION_BONUS_WEIGHT = 100;
const OFF_CENTER_PENALTY_WEIGHT = 100;
const JITTER_PENALTY_WEIGHT = 10;

export function createSinglePendulumScoreCalculator() {
  const context: ITopContext = {
    positiveTime: 0,
    negativeTime: 0,
    jitterDetector: [],
  };

  return (world: IWorld, deltaTime: DOMHighResTimeStamp): number => {
    const [bobVelocity] = bobVelocities(world);

    const isOnTop = firstBobHeading(world) > 0;
    const speedFraction = clamp(
      Math.hypot(bobVelocity.x, bobVelocity.y) / MAX_TRACKED_VELOCITY,
      0,
      1
    );
    const position = Math.abs(zNormalization(world.pivotX, RAILS_HALF_LENGTH));

    context.jitterDetector.push(position);
    if (context.jitterDetector.length > JITTER_WINDOW_SIZE) {
      context.jitterDetector.shift();
    }

    if (isOnTop) {
      context.positiveTime += deltaTime;
      context.negativeTime = 0;
    } else {
      context.negativeTime += deltaTime;
      context.positiveTime = 0;
    }

    let directionChanges = 0;
    let noAction = 0;
    let zeroPosition = 0;

    for (
      let index = 0, sign: number | undefined = undefined;
      index < context.jitterDetector.length - 1;
      index++
    ) {
      const position = context.jitterDetector[index];

      const currentSign = Math.sign(context.jitterDetector[index + 1] - position);

      if (currentSign === 0) {
        noAction++;
        continue;
      }

      noAction = 0;

      if (sign !== undefined && sign !== currentSign) {
        directionChanges++;
      }

      sign = currentSign;

      if (position < CENTER_POSITION_THRESHOLD) {
        zeroPosition += CENTER_POSITION_THRESHOLD - position;
      }
    }

    const targetBonus =
      Math.max(
        (context.positiveTime * (1 + noAction)) / DAMPENED_TIME_DIVISOR,
        context.positiveTime / LINEAR_TIME_DIVISOR
      ) +
      (context.positiveTime / STEADINESS_TIME_DIVISOR) *
        Math.max(0, MAX_STEADINESS_DIRECTION_CHANGES - directionChanges);
    const positionBonus = isOnTop ? zeroPosition * CENTERING_BONUS_WEIGHT : 0;
    const velocityBonus = isOnTop ? (1 - speedFraction) * VELOCITY_BONUS_WEIGHT : 0;
    const actionBonus = isOnTop ? 0 : speedFraction * ACTION_BONUS_WEIGHT;

    const bonus = targetBonus + positionBonus + velocityBonus + actionBonus;

    const positionPenalty =
      position > OFF_CENTER_POSITION_THRESHOLD ? position * OFF_CENTER_PENALTY_WEIGHT : 0;
    const targetPenalty = Math.max(
      (context.negativeTime * (1 + noAction)) / DAMPENED_TIME_DIVISOR,
      context.negativeTime / LINEAR_TIME_DIVISOR
    );
    const jitterPenalty = directionChanges * JITTER_PENALTY_WEIGHT;

    const penalty = positionPenalty + targetPenalty + jitterPenalty;

    return Math.round(bonus - penalty);
  };
}
