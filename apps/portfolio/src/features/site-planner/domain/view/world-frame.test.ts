import { describe, expect, it } from 'vitest';

import { planToWorld } from './world-frame';

const SITE_DATUM = 0;

describe('planToWorld', () => {
  it('sends plan north into −Z', () => {
    expect(planToWorld({ x: 0, y: 10 }, SITE_DATUM)).toEqual([0, 0, -10]);
  });

  it('sends plan south into +Z', () => {
    expect(planToWorld({ x: 0, y: -10 }, SITE_DATUM)).toEqual([0, 0, 10]);
  });

  it('keeps plan east on +X', () => {
    expect(planToWorld({ x: 7, y: 0 }, SITE_DATUM)).toEqual([7, 0, -0]);
  });

  it('lifts the elevation onto +Y', () => {
    expect(planToWorld({ x: 0, y: 0 }, 2.5)).toEqual([0, 2.5, -0]);
  });

  it('leaves the plan origin at the world origin', () => {
    expect(planToWorld({ x: 0, y: 0 }, SITE_DATUM)).toEqual([0, 0, -0]);
  });

  it('keeps the frame right-handed: east × up points south', () => {
    const [eastX, eastY, eastZ] = planToWorld({ x: 1, y: 0 }, SITE_DATUM);
    const [upX, upY, upZ] = planToWorld({ x: 0, y: 0 }, 1);
    const crossProduct = [
      eastY * upZ - eastZ * upY,
      eastZ * upX - eastX * upZ,
      eastX * upY - eastY * upX,
    ];

    expect(crossProduct).toEqual([0, 0, 1]);
  });

  it('preserves distances between plan points', () => {
    const [firstX, , firstZ] = planToWorld({ x: 3, y: 4 }, SITE_DATUM);
    const [secondX, , secondZ] = planToWorld({ x: 0, y: 0 }, SITE_DATUM);

    expect(Math.hypot(firstX - secondX, firstZ - secondZ)).toBe(5);
  });
});
