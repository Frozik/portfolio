import { RAILS_HALF_LENGTH } from '../constants';
import type { IWorld } from '../types';
import { advanceWorld } from './advanceWorld';
import { DEFAULT_GRAVITY } from './gravity';
import { POINTER_PUSH_RADIUS } from './pointer-push';

const DELTA_TIME = 16;
const TRIALS = 2000;

/**
 * Beyond its radius the pointer pushes with exactly zero, so the same forces
 * act either way and the general chain solver runs on a single rod — the only
 * way to compare the two paths through the public surface.
 */
const FAR_AWAY = { x: POINTER_PUSH_RADIUS * 100, y: POINTER_PUSH_RADIUS * 100 };

const generalPath = { gravity: DEFAULT_GRAVITY, pointerPosition: FAR_AWAY };
const singleRodPath = { gravity: DEFAULT_GRAVITY, pointerPosition: undefined };

/** A deterministic sequence, so a disagreement is reproducible. */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

describe('a single rod', () => {
  it('swings exactly as the general chain solver swings it', () => {
    const random = createRandom(20260921);
    let worstDisagreement = 0;

    for (let trial = 0; trial < TRIALS; trial += 1) {
      const world: IWorld = {
        pivotX: (random() * 2 - 1) * RAILS_HALF_LENGTH,
        pivotVelocity: (random() * 2 - 1) * 0.5,
        angles: [(random() * 2 - 1) * Math.PI],
        angularVelocities: [(random() * 2 - 1) * 0.02],
      };
      const action = { pivotVelocity: (random() * 2 - 1) * 0.5 };

      const general = advanceWorld(world, DELTA_TIME, action, generalPath);
      const specialised = advanceWorld(world, DELTA_TIME, action, singleRodPath);

      worstDisagreement = Math.max(
        worstDisagreement,
        Math.abs(general.angles[0] - specialised.angles[0]),
        Math.abs(general.angularVelocities[0] - specialised.angularVelocities[0]),
        Math.abs(general.pivotX - specialised.pivotX),
        Math.abs(general.pivotVelocity - specialised.pivotVelocity)
      );
    }

    expect(worstDisagreement).toBeLessThan(1e-12);
  });

  it('stays at rest hanging straight down', () => {
    const resting: IWorld = { pivotX: 0, pivotVelocity: 0, angles: [0], angularVelocities: [0] };

    const next = advanceWorld(resting, DELTA_TIME, { pivotVelocity: 0 }, singleRodPath);

    expect(next.angles[0]).toBeCloseTo(0, 12);
    expect(next.angularVelocities[0]).toBeCloseTo(0, 12);
  });

  it('takes its kick from a change of the cart velocity, not from the velocity itself', () => {
    const hanging: IWorld = { pivotX: 0, pivotVelocity: 0.2, angles: [0], angularVelocities: [0] };

    // Coasting still stirs the rod a little, because the bob drags through the
    // air at the cart's speed; the point is how much smaller that is.
    const coasting = advanceWorld(hanging, DELTA_TIME, { pivotVelocity: 0.2 }, singleRodPath);
    const accelerating = advanceWorld(hanging, DELTA_TIME, { pivotVelocity: 0.4 }, singleRodPath);

    expect(Math.abs(accelerating.angularVelocities[0])).toBeGreaterThan(
      100 * Math.abs(coasting.angularVelocities[0])
    );
  });
});
