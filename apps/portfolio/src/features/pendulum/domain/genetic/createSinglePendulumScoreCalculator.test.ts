import { RAILS_HALF_LENGTH } from '../constants';
import { createWorld } from '../physics/createWorld';
import { MAX_PIVOT_ACCELERATION } from '../players/pivot-control';
import type { IWorld } from '../types';
import { createSinglePendulumScoreCalculator } from './createSinglePendulumScoreCalculator';

const TICK = 10;
const UPRIGHT: IWorld = { ...createWorld({ bobsCount: 1 }), angles: [Math.PI] };

describe('createSinglePendulumScoreCalculator', () => {
  it('pays nothing for a bob hanging still at the centre', () => {
    expect(createSinglePendulumScoreCalculator()(createWorld({ bobsCount: 1 }), TICK)).toBe(0);
  });

  it('pays the full height reward plus the balance bonus for a still upright bob', () => {
    expect(createSinglePendulumScoreCalculator()(UPRIGHT, TICK)).toBe(2 * TICK);
  });

  it('pays more the higher the bob, without the bonus outside the balance cone', () => {
    const scoreOf = createSinglePendulumScoreCalculator();
    const horizontal = scoreOf({ ...UPRIGHT, angles: [Math.PI / 2] }, TICK);
    const nearlyUp = scoreOf({ ...UPRIGHT, angles: [Math.PI - 0.5] }, TICK);

    expect(horizontal).toBeCloseTo(0.25 * TICK);
    expect(nearlyUp).toBeGreaterThan(horizontal);
    expect(nearlyUp).toBeLessThan(TICK);
  });

  it('pays the bonus anywhere inside the 15° cone', () => {
    const tilted = { ...UPRIGHT, angles: [Math.PI - (14 * Math.PI) / 180] };

    expect(createSinglePendulumScoreCalculator()(tilted, TICK)).toBeGreaterThan(TICK);
  });

  it('takes back half a unit at the rail end', () => {
    expect(
      createSinglePendulumScoreCalculator()({ ...UPRIGHT, pivotX: RAILS_HALF_LENGTH }, TICK)
    ).toBe(1.5 * TICK);
  });

  it('charges for cart acceleration between consecutive ticks', () => {
    const scoreOf = createSinglePendulumScoreCalculator();
    scoreOf(UPRIGHT, TICK);

    const fullThrottle = scoreOf(
      { ...UPRIGHT, pivotVelocity: MAX_PIVOT_ACCELERATION * TICK },
      TICK
    );

    expect(fullThrottle).toBeCloseTo(1.9 * TICK);
  });

  it('scales with the tick length', () => {
    expect(createSinglePendulumScoreCalculator()(UPRIGHT, 3 * TICK)).toBe(6 * TICK);
  });
});

describe('balance bonus stillness', () => {
  it('pays less of the bonus the faster the rod turns through the cone', () => {
    const scoreOf = createSinglePendulumScoreCalculator();
    const turning = scoreOf({ ...UPRIGHT, angularVelocities: [0.0025] }, TICK);

    expect(turning).toBeCloseTo(1.5 * TICK);
  });
});
