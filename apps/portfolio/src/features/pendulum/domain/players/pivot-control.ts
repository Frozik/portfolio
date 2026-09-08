import { clamp } from 'lodash-es';

import type { IAction, IWorld } from '../types';
import { MAX_PIVOT_VELOCITY } from './observation';

/** Three units of gravity: enough to swing the bob up in a couple of strokes. */
export const MAX_PIVOT_ACCELERATION = 0.003;

/**
 * Turns a normalised acceleration command in [−1, 1] into the cart velocity
 * for the coming tick. The pendulum only feels changes of the cart velocity,
 * so a controller that commands acceleration and reads the velocity back is
 * the one that can balance it.
 */
export function accelerate(
  world: IWorld,
  command: number,
  deltaTime: DOMHighResTimeStamp
): IAction {
  return {
    pivotVelocity: clamp(
      world.pivotVelocity + clamp(command, -1, 1) * MAX_PIVOT_ACCELERATION * deltaTime,
      -MAX_PIVOT_VELOCITY,
      MAX_PIVOT_VELOCITY
    ),
  };
}
