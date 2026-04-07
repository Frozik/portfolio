import { clamp, isNil } from 'lodash-es';
import { Body, Engine, Vector } from 'matter-js';

import { RAILS_HALF_LENGTH } from '../constants';
import type { IAction, IWorld } from '../types';

const MAX_FORCE_DISTANCE = 500;
const MAX_FORCE = 0.0005;

export function updateWorld(
  world: IWorld,
  deltaTime: DOMHighResTimeStamp,
  action: IAction,
  additionalForcePosition?: { x: number; y: number }
) {
  if (deltaTime === 0) {
    return;
  }

  const { engine, pivot } = world;

  const position = Vector.add(pivot.position, {
    x: action.pivotVelocity * deltaTime,
    y: 0,
  });

  Body.setPosition(pivot, {
    x: clamp(position.x, -RAILS_HALF_LENGTH, RAILS_HALF_LENGTH),
    y: 0,
  });

  if (!isNil(additionalForcePosition)) {
    const forcePosition = additionalForcePosition;

    world.bobs.forEach(bob => {
      const vectorToBob = Vector.sub(bob.position, forcePosition);
      const magnitude = Vector.magnitude(vectorToBob);

      if (magnitude > MAX_FORCE_DISTANCE) {
        return;
      }

      const force = Vector.mult(
        Vector.normalise(vectorToBob),
        ((MAX_FORCE_DISTANCE - magnitude) / MAX_FORCE_DISTANCE) * MAX_FORCE
      );

      Body.applyForce(bob, bob.position, force);
    });
  }

  Engine.update(engine, deltaTime);
}
