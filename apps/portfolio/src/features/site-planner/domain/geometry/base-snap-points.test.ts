import { describe, expect, it } from 'vitest';

import { createCircle, createRectangle } from '../model/shapes';
import { baseSnapPoints, slideOntoCircleRim } from './base-snap-points';

describe('baseSnapPoints', () => {
  it('gives a circle its centre and four quadrants — the only real points it has', () => {
    const circle = createCircle({ center: { x: 10, y: 20 }, radius: 5 });

    expect(baseSnapPoints([circle])).toEqual([
      { x: 10, y: 20 },
      { x: 15, y: 20 },
      { x: 10, y: 25 },
      { x: 5, y: 20 },
      { x: 10, y: 15 },
    ]);
  });

  it('adds edge midpoints to a rectangle — where a partition typically starts', () => {
    const rectangle = createRectangle({
      center: { x: 0, y: 0 },
      width: 4,
      length: 2,
      rotationDegrees: 0,
    });
    const points = baseSnapPoints([rectangle]);

    for (const midpoint of [
      { x: 0, y: -1 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: -2, y: 0 },
    ]) {
      expect(points).toContainEqual(
        expect.objectContaining({
          x: expect.closeTo(midpoint.x, 9),
          y: expect.closeTo(midpoint.y, 9),
        })
      );
    }
  });
});

describe('slideOntoCircleRim', () => {
  const circle = createCircle({ center: { x: 0, y: 0 }, radius: 6 });

  it('lands the point exactly at the radius, whatever facet the cursor was on', () => {
    const projected = slideOntoCircleRim([circle], { x: 4, y: 4 }, 1);

    expect(projected).toBeDefined();
    expect(Math.hypot(projected?.x ?? 0, projected?.y ?? 0)).toBeCloseTo(6);
  });

  it('reaches out only as far as it is told', () => {
    expect(slideOntoCircleRim([circle], { x: 10, y: 0 }, 1)).toBeUndefined();
    expect(slideOntoCircleRim([circle], { x: 6.5, y: 0 }, 1)).toEqual({ x: 6, y: 0 });
  });

  it('answers with the nearest of several rims', () => {
    const far = createCircle({ center: { x: 100, y: 0 }, radius: 6 });

    expect(slideOntoCircleRim([far, circle], { x: 6.2, y: 0 }, 1)).toEqual({ x: 6, y: 0 });
  });

  it('names no direction from the dead centre', () => {
    expect(slideOntoCircleRim([circle], { x: 0, y: 0 }, 100)).toBeUndefined();
  });
});
