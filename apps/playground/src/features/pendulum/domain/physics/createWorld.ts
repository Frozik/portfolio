import { assert } from '@frozik/utils';
import { clamp, isNil } from 'lodash-es';
import { Bodies, Body, Constraint, Engine, World } from 'matter-js';

import { BOB_RADIUS, RAILS_HALF_LENGTH, ROD_LENGTH } from '../constants';
import type { IPendulumOptions, IWorld } from '../types';

export function createWorld(options: IPendulumOptions): IWorld {
  assert(options.bobsCount >= 1, 'Bobs count must be at least 1');

  const engine = Engine.create();
  const { world } = engine;

  const pivot = Bodies.circle(0, 0, BOB_RADIUS, {
    inertia: Number.POSITIVE_INFINITY,
    inverseInertia: 0,
    restitution: 1,
    friction: 0,
    frictionAir: 0,
    frictionStatic: 0,
  });
  Body.setStatic(pivot, true);

  World.add(world, [pivot]);

  const bobs: Body[] = [];

  for (let connectionBob = pivot, index = 0; index < options.bobsCount; index++) {
    const bob = Bodies.circle(0, ROD_LENGTH * (index + 1), BOB_RADIUS, {
      inertia: Number.POSITIVE_INFINITY,
      inverseInertia: 0,
      restitution: 1,
      friction: 0,
      frictionAir: 0,
      frictionStatic: 0,
    });

    World.add(world, [bob]);

    World.add(
      world,
      Constraint.create({
        bodyA: connectionBob,
        bodyB: bob,
        stiffness: 1,
        damping: 0,
      })
    );

    connectionBob = bob;

    bobs.push(bob);
  }

  if (!isNil(options.pivotPosition) && options.pivotPosition !== 0) {
    Body.setPosition(pivot, {
      x: clamp(options.pivotPosition, -RAILS_HALF_LENGTH, RAILS_HALF_LENGTH),
      y: 0,
    });
  }

  return {
    engine,
    pivot,
    bobs,
  };
}
