import { describe, expect, it } from 'vitest';

import { multiPolygonArea } from './building-outline';
import { isPointInMultiPolygon, subtractPolygons } from './polygon-booleans';
import type { MultiPolygon } from './polygon-types';

const SQUARE: MultiPolygon = [
  {
    outer: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    holes: [],
  },
];

/** A full-width band across the middle of the square. */
const BAND: MultiPolygon = [
  {
    outer: [
      { x: -1, y: 4.8 },
      { x: 11, y: 4.8 },
      { x: 11, y: 5.2 },
      { x: -1, y: 5.2 },
    ],
    holes: [],
  },
];

describe('subtractPolygons', () => {
  it('splits a region a band crosses into two', () => {
    const regions = subtractPolygons(SQUARE, BAND);

    expect(regions).toHaveLength(2);
    expect(multiPolygonArea(regions)).toBeCloseTo(100 - 10 * 0.4, 2);
  });

  it('leaves the subject alone against an empty clip', () => {
    expect(subtractPolygons(SQUARE, [])).toBe(SQUARE);
  });
});

describe('isPointInMultiPolygon', () => {
  it('answers inside, outside and inside-a-hole correctly', () => {
    const withHole: MultiPolygon = [
      {
        ...SQUARE[0],
        holes: [
          [
            { x: 4, y: 4 },
            { x: 4, y: 6 },
            { x: 6, y: 6 },
            { x: 6, y: 4 },
          ],
        ],
      },
    ];

    expect(isPointInMultiPolygon(withHole, { x: 1, y: 1 })).toBe(true);
    expect(isPointInMultiPolygon(withHole, { x: 5, y: 5 })).toBe(false);
    expect(isPointInMultiPolygon(withHole, { x: 11, y: 5 })).toBe(false);
  });
});
