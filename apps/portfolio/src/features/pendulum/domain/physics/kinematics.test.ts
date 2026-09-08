import { ROD_LENGTH } from '../constants';
import type { IWorld } from '../types';
import { bobPositions, bobVelocities, pivotPosition } from './kinematics';

const REST: IWorld = { pivotX: 40, pivotVelocity: 0, angles: [0, 0], angularVelocities: [0, 0] };

describe('pivotPosition', () => {
  it('places the pivot on the rail line at its rail coordinate', () => {
    expect(pivotPosition(REST)).toEqual({ x: 40, y: 0 });
  });
});

describe('bobPositions', () => {
  it('hangs the chain straight down when every angle is zero', () => {
    expect(bobPositions(REST)).toEqual([
      { x: 40, y: ROD_LENGTH },
      { x: 40, y: 2 * ROD_LENGTH },
    ]);
  });

  it('measures each angle from the downward vertical towards positive x', () => {
    const [first, second] = bobPositions({ ...REST, angles: [Math.PI / 2, 0] });

    expect(first.x).toBeCloseTo(40 + ROD_LENGTH);
    expect(first.y).toBeCloseTo(0);
    expect(second.x).toBeCloseTo(40 + ROD_LENGTH);
    expect(second.y).toBeCloseTo(ROD_LENGTH);
  });
});

describe('bobVelocities', () => {
  it('moves a resting chain along with the pivot', () => {
    expect(bobVelocities({ ...REST, pivotVelocity: 0.5 })).toEqual([
      { x: 0.5, y: 0 },
      { x: 0.5, y: 0 },
    ]);
  });

  it('adds the tangential speed of every rod up the chain', () => {
    const [first, second] = bobVelocities({ ...REST, angularVelocities: [0.01, 0.02] });

    expect(first).toEqual({ x: ROD_LENGTH * 0.01, y: 0 });
    expect(second).toEqual({ x: ROD_LENGTH * 0.03, y: 0 });
  });
});
