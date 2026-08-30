import { describe, expect, it } from 'vitest';

import { densifyRing } from './densify-ring';
import type { Ring } from './polygon-types';

const UNIT_SQUARE: Ring = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('densifyRing', () => {
  it('splits every edge into segments no longer than the limit', () => {
    const points = densifyRing(UNIT_SQUARE, 4);

    expect(points).toHaveLength(4 * 3);

    for (let index = 0; index < points.length; index += 1) {
      const start = points[index];
      const end = points[(index + 1) % points.length];

      expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeLessThanOrEqual(4 + 1e-9);
    }
  });

  it('keeps the original vertices in order', () => {
    const points = densifyRing(UNIT_SQUARE, 4);

    for (const corner of UNIT_SQUARE) {
      expect(points).toContainEqual(corner);
    }

    expect(points[0]).toEqual(UNIT_SQUARE[0]);
    expect(points[3]).toEqual(UNIT_SQUARE[1]);
  });

  it('leaves edges shorter than the limit untouched', () => {
    expect(densifyRing(UNIT_SQUARE, 100)).toEqual(UNIT_SQUARE);
  });

  it('returns the ring unchanged when it cannot be split', () => {
    const single: Ring = [{ x: 1, y: 2 }];

    expect(densifyRing(single, 1)).toEqual(single);
    expect(densifyRing(UNIT_SQUARE, 0)).toEqual(UNIT_SQUARE);
  });
});
