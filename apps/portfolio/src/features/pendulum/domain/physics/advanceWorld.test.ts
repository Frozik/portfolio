import { RAILS_HALF_LENGTH, ROD_LENGTH } from '../constants';
import type { IEnvironment, IWorld } from '../types';
import { advanceWorld, MAX_SUBSTEP } from './advanceWorld';
import { createWorld } from './createWorld';
import { GRAVITY_UNIT } from './gravity';
import { bobPositions } from './kinematics';

const STILL = { pivotVelocity: 0 };
const FRAME = 16;
const CALM: IEnvironment = { gravity: 1, pointerPosition: undefined };

function swingFor(world: IWorld, duration: number, environment = CALM): IWorld {
  let current = world;
  for (let elapsed = 0; elapsed < duration; elapsed += FRAME) {
    current = advanceWorld(current, FRAME, STILL, environment);
  }
  return current;
}

/** Twice the time between two consecutive turning points of the first rod. */
function measurePeriod(world: IWorld, environment: IEnvironment): number {
  const turningPoints: number[] = [];
  let current = world;
  let elapsed = 0;

  while (turningPoints.length < 2) {
    const next = advanceWorld(current, MAX_SUBSTEP, STILL, environment);
    elapsed += MAX_SUBSTEP;
    if (next.angularVelocities[0] * current.angularVelocities[0] < 0) {
      turningPoints.push(elapsed);
    }
    current = next;
  }

  return 2 * (turningPoints[1] - turningPoints[0]);
}

describe('advanceWorld', () => {
  it('leaves a hanging chain at rest', () => {
    expect(swingFor(createWorld({ bobsCount: 2 }), 1000)).toEqual(createWorld({ bobsCount: 2 }));
  });

  it('swings a small displacement with the period 2π·√(L/g)', () => {
    const expected = 2 * Math.PI * Math.sqrt(ROD_LENGTH / GRAVITY_UNIT);
    const world: IWorld = { ...createWorld({ bobsCount: 1 }), angles: [0.05] };

    expect(measurePeriod(world, CALM) / expected).toBeCloseTo(1, 2);
  });

  it('halves the period when the gravity slider is quadrupled', () => {
    const world: IWorld = { ...createWorld({ bobsCount: 1 }), angles: [0.05] };

    expect(measurePeriod(world, { ...CALM, gravity: 4 }) / measurePeriod(world, CALM)).toBeCloseTo(
      0.5,
      2
    );
  });

  it('lets air drag damp a wide swing without stopping it within a minute', () => {
    const world: IWorld = { ...createWorld({ bobsCount: 1 }), angles: [1] };

    const afterOneMinute = swingFor(world, 60_000);
    const amplitude = Math.hypot(
      afterOneMinute.angles[0],
      afterOneMinute.angularVelocities[0] * Math.sqrt(ROD_LENGTH / GRAVITY_UNIT)
    );

    expect(amplitude).toBeLessThan(0.6);
    expect(amplitude).toBeGreaterThan(0.1);
  });

  it('moves the pivot at the requested velocity and kicks the chain the other way', () => {
    const world = advanceWorld(createWorld({ bobsCount: 1 }), FRAME, { pivotVelocity: 1 }, CALM);

    expect(world.pivotX).toBe(FRAME);
    expect(world.pivotVelocity).toBe(1);
    expect(world.angularVelocities[0]).toBeCloseTo(-1 / ROD_LENGTH, 4);
    expect(world.angles[0]).toBeLessThan(0);
  });

  it('kicks the chain only when the pivot velocity changes, not while it glides', () => {
    const gliding = advanceWorld(createWorld({ bobsCount: 1 }), FRAME, { pivotVelocity: 1 }, CALM);

    const glided = advanceWorld(gliding, FRAME, { pivotVelocity: 1 }, CALM);

    expect(Math.abs(glided.angularVelocities[0] - gliding.angularVelocities[0])).toBeLessThan(1e-4);
  });

  it('stops the pivot at the rail end and reports the velocity it actually had', () => {
    const nearEnd: IWorld = { ...createWorld({ bobsCount: 1 }), pivotX: RAILS_HALF_LENGTH - 4 };

    const world = advanceWorld(nearEnd, FRAME, { pivotVelocity: 1 }, CALM);

    expect(world.pivotX).toBe(RAILS_HALF_LENGTH);
    expect(world.pivotVelocity).toBe(4 / FRAME);
  });

  it('pushes the bobs away from the pointer', () => {
    const world = createWorld({ bobsCount: 1 });
    const [bob] = bobPositions(world);

    const pushed = advanceWorld(world, FRAME, STILL, {
      ...CALM,
      pointerPosition: { x: bob.x - 50, y: bob.y },
    });

    expect(pushed.angularVelocities[0]).toBeGreaterThan(0);
  });

  it('wraps angles into [−π, π) however far the chain spins', () => {
    const spinning: IWorld = { ...createWorld({ bobsCount: 1 }), angularVelocities: [0.05] };

    const world = swingFor(spinning, 2000);

    expect(world.angles[0]).toBeGreaterThanOrEqual(-Math.PI);
    expect(world.angles[0]).toBeLessThan(Math.PI);
  });

  it('ignores a tick without elapsed time', () => {
    const world = createWorld({ bobsCount: 1 });

    expect(advanceWorld(world, 0, { pivotVelocity: 1 }, CALM)).toBe(world);
  });
});
