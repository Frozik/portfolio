import { RAILS_HALF_LENGTH } from '../constants';
import { createWorld } from '../physics/createWorld';
import {
  ANGULAR_VELOCITY_SCALE,
  BALANCE_CONE,
  MAX_PIVOT_VELOCITY,
  observe,
  OBSERVATION_SIZE,
} from './observation';

describe('observe', () => {
  it('reports five values', () => {
    expect(observe(createWorld({ bobsCount: 1 }))).toHaveLength(OBSERVATION_SIZE);
  });

  it('reads the upright as cosine 1 and the hanging bob as cosine −1', () => {
    const hanging = observe(createWorld({ bobsCount: 1 }));
    const upright = observe({ ...createWorld({ bobsCount: 1 }), angles: [Math.PI] });

    expect(hanging[1]).toBe(-1);
    expect(upright[1]).toBe(-1 * -1);
    expect(upright[0]).toBeCloseTo(0);
  });

  it('keeps the angle continuous across the seam of the wrapped angle', () => {
    const justBelow = observe({ ...createWorld({ bobsCount: 1 }), angles: [Math.PI - 0.001] });
    const justAbove = observe({ ...createWorld({ bobsCount: 1 }), angles: [-Math.PI + 0.001] });

    expect(justBelow[0]).toBeCloseTo(justAbove[0], 1);
    expect(justBelow[1]).toBeCloseTo(justAbove[1], 5);
  });

  it('resolves the lean inside the balance cone and saturates beyond it', () => {
    const halfCone = observe({
      ...createWorld({ bobsCount: 1 }),
      angles: [Math.PI - BALANCE_CONE / 2],
    });
    const sideways = observe({ ...createWorld({ bobsCount: 1 }), angles: [Math.PI / 2] });

    expect(halfCone[0]).toBeCloseTo(-Math.sin(BALANCE_CONE / 2) / Math.sin(BALANCE_CONE));
    expect(sideways[0]).toBe(-1);
  });

  it('normalises and saturates the angular velocity, rail position and cart velocity', () => {
    const [, , angularVelocity, position, velocity] = observe({
      ...createWorld({ bobsCount: 1 }),
      angularVelocities: [ANGULAR_VELOCITY_SCALE / 2],
      pivotX: -RAILS_HALF_LENGTH,
      pivotVelocity: MAX_PIVOT_VELOCITY,
    });

    expect(angularVelocity).toBe(0.5);
    expect(position).toBe(-1);
    expect(velocity).toBe(1);
  });
});
