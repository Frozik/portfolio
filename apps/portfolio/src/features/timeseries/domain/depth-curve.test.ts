import { describe, expect, it } from 'vitest';

import { DEPTH_EXTENT, depthCurve } from './depth-curve';

describe('depth curve', () => {
  it('spans the whole axis in ascending order', () => {
    const { x } = depthCurve(0);

    expect(x[0]).toBe(0);
    expect(x.at(-1)).toBe(DEPTH_EXTENT);
    expect(Array.from(x)).toEqual(Array.from(x).sort((first, second) => first - second));
  });

  it('is the same at the same phase and another at another', () => {
    expect(depthCurve(1).value).toEqual(depthCurve(1).value);
    expect(depthCurve(1).value).not.toEqual(depthCurve(2).value);
  });

  it('never falls below its base level', () => {
    expect(Math.min(...depthCurve(3).value)).toBeGreaterThanOrEqual(5);
  });
});
