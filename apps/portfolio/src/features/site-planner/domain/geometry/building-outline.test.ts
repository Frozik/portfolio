import { describe, expect, it } from 'vitest';

import { DEFAULT_FOUNDATION } from '../model/foundation';
import {
  foundationVolumeCubicMeters,
  multiPolygonArea,
  outlineLength,
  pointOnOutline,
} from './building-outline';
import type { MultiPolygon } from './polygon-types';

/** A 10 × 6 rectangle with its corner at the origin, counter-clockwise. */
const RECTANGLE: MultiPolygon = [
  {
    outer: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 6 },
      { x: 0, y: 6 },
    ],
    holes: [],
  },
];

describe('outlineLength', () => {
  it('measures the outer ring and ignores holes', () => {
    expect(outlineLength(RECTANGLE)).toBeCloseTo(32);
    expect(
      outlineLength([
        {
          ...RECTANGLE[0],
          holes: [
            [
              { x: 2, y: 2 },
              { x: 2, y: 4 },
              { x: 4, y: 4 },
              { x: 4, y: 2 },
            ],
          ],
        },
      ])
    ).toBeCloseTo(32);
  });
});

describe('pointOnOutline', () => {
  it('walks the ring from its first vertex', () => {
    expect(pointOnOutline(RECTANGLE, 0)).toEqual({ x: 0, y: 0 });
    expect(pointOnOutline(RECTANGLE, 5)).toEqual({ x: 5, y: 0 });
    expect(pointOnOutline(RECTANGLE, 13)).toEqual({ x: 10, y: 3 });
  });

  it('wraps an offset that outgrew the perimeter back onto the outline', () => {
    expect(pointOnOutline(RECTANGLE, 32 + 5)).toEqual({ x: 5, y: 0 });
    expect(pointOnOutline(RECTANGLE, -6)?.y).toBeCloseTo(6);
  });

  it('answers nothing for a footprint with no outline', () => {
    expect(pointOnOutline([], 5)).toBeUndefined();
  });
});

describe('multiPolygonArea', () => {
  it('subtracts holes from the outer area', () => {
    expect(multiPolygonArea(RECTANGLE)).toBeCloseTo(60);
    expect(
      multiPolygonArea([
        {
          ...RECTANGLE[0],
          holes: [
            [
              { x: 2, y: 2 },
              { x: 2, y: 4 },
              { x: 4, y: 4 },
              { x: 4, y: 2 },
            ],
          ],
        },
      ])
    ).toBeCloseTo(56);
  });
});

describe('foundationVolumeCubicMeters', () => {
  it('fills the footprint for a slab and runs the outline for a stem wall', () => {
    const slab = foundationVolumeCubicMeters(
      { kind: 'slab', depthMeters: 0.3, heightAboveGroundMeters: 0.3 },
      RECTANGLE
    );
    const stemWall = foundationVolumeCubicMeters(
      { kind: 'stem-wall', depthMeters: 1, heightAboveGroundMeters: 0.5 },
      RECTANGLE
    );

    expect(slab).toBeCloseTo(60 * 0.6);
    // 32 m of run × 0.4 m typical width × 1.5 m height.
    expect(stemWall).toBeCloseTo(32 * 0.4 * 1.5);
  });

  it('does not estimate piers — their count is not chosen yet', () => {
    expect(
      foundationVolumeCubicMeters({ ...DEFAULT_FOUNDATION, kind: 'pier' }, RECTANGLE)
    ).toBeUndefined();
  });
});
