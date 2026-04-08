import { clamp } from 'lodash-es';
import { Vector } from 'matter-js';

import { RAILS_HALF_LENGTH } from '../constants';
import type { IWorld } from '../types';
import { zNormalization } from '../utils';

interface ITopContext {
  positiveTime: DOMHighResTimeStamp;
  negativeTime: DOMHighResTimeStamp;
  jitterDetector: number[];
}

export function singlePendulumScoreCalculatorBuilder(world: IWorld) {
  const context: ITopContext = {
    positiveTime: 0,
    negativeTime: 0,
    jitterDetector: [],
  };

  return (deltaTime: DOMHighResTimeStamp): number => {
    const {
      pivot,
      bobs: [bob],
    } = world;

    const angleVector = Vector.sub(bob.position, pivot.position);
    const angle = Vector.angle(angleVector, { x: 0, y: 1 });
    const isOnTop = angle > 0;
    const velocity = clamp(Vector.magnitude(bob.velocity), 0, 10);
    const position = Math.abs(zNormalization(pivot.position.x, RAILS_HALF_LENGTH));

    context.jitterDetector.push(position);
    if (context.jitterDetector.length > 50) {
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

      if (position < 0.1) {
        zeroPosition += 0.1 - position;
      }
    }

    const targetBonus =
      Math.max((context.positiveTime * (1 + noAction)) / 800, context.positiveTime / 50) +
      (context.positiveTime / 20) * Math.max(0, 5 - directionChanges);
    const positionBonus = isOnTop ? zeroPosition * 10 : 0;
    const velocityBonus = isOnTop ? (10 - velocity) * 10 : 0;
    const actionBonus = isOnTop ? 0 : velocity * 10;

    const bonus = targetBonus + positionBonus + velocityBonus + actionBonus;

    const positionPenalty = position > 0.2 ? position * 100 : 0;
    const targetPenalty = Math.max(
      (context.negativeTime * (1 + noAction)) / 800,
      context.negativeTime / 50
    );
    const jitterPenalty = directionChanges * 10;

    const penalty = positionPenalty + targetPenalty + jitterPenalty;

    return Math.round(bonus - penalty);
  };
}
