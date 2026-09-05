import { nextSpeedMultiplier, randomizedSubsteps, realTimeStep } from './simulation-speed';

describe('nextSpeedMultiplier', () => {
  it('speeds up by one step while the frame rate is healthy', () => {
    expect(nextSpeedMultiplier(3, 60)).toBe(4);
  });

  it('slows down by one step when the frame rate drops below 30', () => {
    expect(nextSpeedMultiplier(3, 20)).toBe(2);
  });

  it('never slows below real time', () => {
    expect(nextSpeedMultiplier(1, 5)).toBe(1);
  });

  it('caps the speed-up at 16 steps per frame', () => {
    expect(nextSpeedMultiplier(16, 120)).toBe(16);
  });
});

describe('randomizedSubsteps', () => {
  it('produces one substep per multiplier unit', () => {
    expect(randomizedSubsteps(4, () => 0.5)).toHaveLength(4);
  });

  it('spreads substeps between 8 and 32 milliseconds', () => {
    expect(randomizedSubsteps(1, () => 0)).toEqual([8]);
    expect(randomizedSubsteps(1, () => 1)).toEqual([32]);
  });

  it('rounds substeps to a hundredth of a millisecond', () => {
    expect(randomizedSubsteps(1, () => 0.123456)).toEqual([10.96]);
  });
});

describe('realTimeStep', () => {
  it('simulates exactly the elapsed frame time regardless of the multiplier', () => {
    expect(realTimeStep(16.7, 8)).toEqual([16.7]);
  });
});
