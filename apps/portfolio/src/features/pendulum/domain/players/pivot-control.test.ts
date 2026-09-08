import { createWorld } from '../physics/createWorld';
import { MAX_PIVOT_VELOCITY } from './observation';
import { accelerate, MAX_PIVOT_ACCELERATION } from './pivot-control';

describe('accelerate', () => {
  it('adds the commanded acceleration over the tick to the cart velocity', () => {
    const world = { ...createWorld({ bobsCount: 1 }), pivotVelocity: 0.2 };

    expect(accelerate(world, 0.5, 10).pivotVelocity).toBeCloseTo(
      0.2 + 0.5 * MAX_PIVOT_ACCELERATION * 10
    );
  });

  it('clamps the command to the unit range and the velocity to the cart limit', () => {
    const world = { ...createWorld({ bobsCount: 1 }), pivotVelocity: MAX_PIVOT_VELOCITY - 0.001 };

    expect(accelerate(world, 7, 1000).pivotVelocity).toBe(MAX_PIVOT_VELOCITY);
    expect(accelerate(world, -7, 1000).pivotVelocity).toBe(-MAX_PIVOT_VELOCITY);
  });

  it('coasts when the command is zero', () => {
    const world = { ...createWorld({ bobsCount: 1 }), pivotVelocity: -0.4 };

    expect(accelerate(world, 0, 16)).toEqual({ pivotVelocity: -0.4 });
  });
});
