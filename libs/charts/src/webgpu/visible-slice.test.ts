import { describe, expect, it } from 'vitest';

import { joinInstances, visibleSliceOf } from './visible-slice';

describe('the visible slice of a layer', () => {
  it('counts from the first element of the first chunk drawn, not of the run', () => {
    const slice = visibleSliceOf('point', 300, 340, 128, 128);

    expect(slice).toEqual({ firstElement: 44, elementCount: 40, firstPoint: 44, pointCount: 40 });
  });

  it('spans chunks', () => {
    expect(visibleSliceOf('point', 100, 200, 128, 256)).toMatchObject({
      firstElement: 100,
      elementCount: 100,
    });
  });

  it('counts four points to a candle', () => {
    expect(visibleSliceOf('candle', 70, 80, 64, 64)).toEqual({
      firstElement: 6,
      elementCount: 10,
      firstPoint: 24,
      pointCount: 40,
    });
  });

  it('stops at what the texture could hold when it ran out of room', () => {
    expect(visibleSliceOf('point', 100, 400, 128, 128).elementCount).toBe(28);
  });
});

describe('the instances that join visible points', () => {
  const slice = visibleSliceOf('point', 300, 340, 128, 128);

  it('is a segment per pair of neighbours, starting at the first visible point', () => {
    expect(joinInstances(slice, 'linear')).toEqual({ first: 44, count: 39 });
  });

  it('is two segments per pair with a step join', () => {
    expect(joinInstances(slice, 'stepAfter')).toEqual({ first: 88, count: 78 });
  });

  it('is nothing for a single point', () => {
    expect(joinInstances(visibleSliceOf('point', 5, 6, 128, 128), 'linear').count).toBe(0);
  });
});
