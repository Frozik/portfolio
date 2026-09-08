import { wrapToHalfTurn } from '@frozik/utils/math/wrapToHalfTurn';
import { clamp, isNil } from 'lodash-es';

import { RAILS_HALF_LENGTH } from '../constants';
import type { IAction, IEnvironment, IPoint, IWorld } from '../types';
import type { IChainState } from './chain-dynamics';
import { angularAccelerations, angularVelocitiesAfterPivotKick } from './chain-dynamics';
import { gravityAcceleration } from './gravity';
import { rungeKutta4Step } from './integrate';
import { bobPositions, bobVelocities } from './kinematics';
import { dragAcceleration } from './medium';
import { pointerPushAcceleration } from './pointer-push';

/**
 * Longest RK4 substep. The slowest motion is the 2 s small-angle swing, so
 * even the fastest spin the robots reach stays far below the step's
 * stability limit and the energy drift is invisible over an hour.
 */
export const MAX_SUBSTEP = 4;

/**
 * One tick: the pivot moves at the requested velocity (stopped by the rail
 * ends), its velocity jump kicks the chain, then the chain swings through the
 * tick under gravity, the pointer push and air drag.
 */
export function advanceWorld(
  world: IWorld,
  deltaTime: DOMHighResTimeStamp,
  action: IAction,
  environment: IEnvironment
): IWorld {
  if (deltaTime <= 0) {
    return world;
  }

  const pivotX = clamp(
    world.pivotX + action.pivotVelocity * deltaTime,
    -RAILS_HALF_LENGTH,
    RAILS_HALF_LENGTH
  );
  const pivotVelocity = (pivotX - world.pivotX) / deltaTime;
  const gravity = gravityAcceleration(environment.gravity);

  const derivative = (state: IChainState, elapsed: DOMHighResTimeStamp): IChainState => {
    const snapshot: IWorld = {
      ...state,
      pivotX: world.pivotX + pivotVelocity * elapsed,
      pivotVelocity,
    };
    const velocities = bobVelocities(snapshot);
    const accelerations = bobPositions(snapshot).map((position, index) =>
      totalAcceleration(gravity, environment.pointerPosition, position, velocities[index])
    );

    return {
      angles: state.angularVelocities,
      angularVelocities: angularAccelerations(state, accelerations),
    };
  };

  let chain: IChainState = {
    angles: world.angles,
    angularVelocities: angularVelocitiesAfterPivotKick(world, pivotVelocity - world.pivotVelocity),
  };
  const substeps = Math.ceil(deltaTime / MAX_SUBSTEP);
  const step = deltaTime / substeps;

  for (let index = 0; index < substeps; index++) {
    chain = rungeKutta4Step(chain, index * step, step, derivative);
  }

  return {
    pivotX,
    pivotVelocity,
    angles: chain.angles.map(wrapToHalfTurn),
    angularVelocities: chain.angularVelocities,
  };
}

function totalAcceleration(
  gravity: number,
  pointer: IPoint | undefined,
  position: IPoint,
  velocity: IPoint
): IPoint {
  const push = isNil(pointer) ? undefined : pointerPushAcceleration(pointer, position);
  const drag = dragAcceleration(velocity);

  return {
    x: (push?.x ?? 0) + drag.x,
    y: gravity + (push?.y ?? 0) + drag.y,
  };
}
