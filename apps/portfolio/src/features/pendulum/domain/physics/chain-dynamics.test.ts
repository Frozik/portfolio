import { ROD_LENGTH } from '../constants';
import type { IPoint } from '../types';
import type { IChainState } from './chain-dynamics';
import { angularAccelerations, angularVelocitiesAfterPivotKick } from './chain-dynamics';
import { rungeKutta4Step } from './integrate';

const GRAVITY = 0.001;
const GRAVITY_ONLY: IPoint = { x: 0, y: GRAVITY };

describe('angularAccelerations', () => {
  it('swings a single bob back towards the vertical: θ̈ = −(g/L)·sin θ', () => {
    const angle = 0.7;

    const [acceleration] = angularAccelerations({ angles: [angle], angularVelocities: [0] }, [
      GRAVITY_ONLY,
    ]);

    expect(acceleration).toBeCloseTo((-GRAVITY / ROD_LENGTH) * Math.sin(angle), 12);
  });

  it('leaves a hanging chain at rest', () => {
    expect(
      angularAccelerations({ angles: [0, 0, 0], angularVelocities: [0, 0, 0] }, [
        GRAVITY_ONLY,
        GRAVITY_ONLY,
        GRAVITY_ONLY,
      ])
    ).toEqual([0, 0, 0]);
  });

  it('turns a sideways push on the last bob into torque on every joint above it', () => {
    const [upper, lower] = angularAccelerations({ angles: [0, 0], angularVelocities: [0, 0] }, [
      { x: 0, y: 0 },
      { x: GRAVITY, y: 0 },
    ]);

    expect(upper).toBeCloseTo(0, 12);
    expect(lower).toBeCloseTo(GRAVITY / ROD_LENGTH, 12);
  });

  it('conserves the energy of a double pendulum through ten seconds of RK4', () => {
    let state: IChainState = { angles: [2, 1], angularVelocities: [0, 0] };
    const initialEnergy = energy(state);
    const step = 4;
    const derivative = (current: IChainState): IChainState => ({
      angles: current.angularVelocities,
      angularVelocities: angularAccelerations(current, [GRAVITY_ONLY, GRAVITY_ONLY]),
    });

    for (let elapsed = 0; elapsed < 10_000; elapsed += step) {
      state = rungeKutta4Step(state, elapsed, step, derivative);
    }

    expect(Math.abs(energy(state) - initialEnergy) / Math.abs(initialEnergy)).toBeLessThan(1e-5);
  });
});

describe('angularVelocitiesAfterPivotKick', () => {
  it('swings a hanging bob back against a pivot that jumps forward: Δθ̇ = −Δv·cos θ / L', () => {
    const angle = 0.3;

    const [velocity] = angularVelocitiesAfterPivotKick(
      { angles: [angle], angularVelocities: [0.002] },
      0.5
    );

    expect(velocity).toBeCloseTo(0.002 - (0.5 * Math.cos(angle)) / ROD_LENGTH, 12);
  });

  it('cannot reach a bob pointing along the rails', () => {
    const [velocity] = angularVelocitiesAfterPivotKick(
      { angles: [Math.PI / 2], angularVelocities: [0] },
      1
    );

    expect(velocity).toBeCloseTo(0, 12);
  });

  it('returns the same velocities when the pivot velocity did not change', () => {
    const angularVelocities = [0.1, -0.1];

    expect(angularVelocitiesAfterPivotKick({ angles: [1, 2], angularVelocities }, 0)).toBe(
      angularVelocities
    );
  });
});

/** Kinetic plus potential energy per unit mass of a chain in a field g pointing down. */
function energy({ angles, angularVelocities }: IChainState): number {
  let total = 0;
  let velocityX = 0;
  let velocityY = 0;
  let depth = 0;

  for (const [index, angle] of angles.entries()) {
    velocityX += ROD_LENGTH * angularVelocities[index] * Math.cos(angle);
    velocityY -= ROD_LENGTH * angularVelocities[index] * Math.sin(angle);
    depth += ROD_LENGTH * Math.cos(angle);
    total += (velocityX * velocityX + velocityY * velocityY) / 2 - GRAVITY * depth;
  }

  return total;
}
