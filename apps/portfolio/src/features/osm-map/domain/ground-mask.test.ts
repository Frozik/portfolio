import type { MultiPolygon } from '@frozik/utils/geometry/polygonTypes';

import { groundMaskOf, isGroundFree } from './ground-mask';

const TILE_SIZE_M = 100;

/** A 60 m pond with a 20 m island, counter-clockwise outer and clockwise hole, y north. */
const POND_WITH_ISLAND: MultiPolygon = [
  {
    outer: [
      { x: 20, y: -20 },
      { x: 20, y: -80 },
      { x: 80, y: -80 },
      { x: 80, y: -20 },
    ],
    holes: [
      [
        { x: 40, y: -40 },
        { x: 60, y: -40 },
        { x: 60, y: -60 },
        { x: 40, y: -60 },
      ],
    ],
  },
];

describe('ground mask', () => {
  it('takes the ground of an area and leaves its hole free', () => {
    const mask = groundMaskOf(TILE_SIZE_M, { areas: POND_WITH_ISLAND, lines: [] });

    expect(isGroundFree({ x: 30, y: -30 }, 0, mask)).toBe(false);
    expect(isGroundFree({ x: 50, y: -50 }, 0, mask)).toBe(true);
    expect(isGroundFree({ x: 10, y: -50 }, 0, mask)).toBe(true);
    expect(isGroundFree({ x: 90, y: -90 }, 0, mask)).toBe(true);
  });

  it('takes a band as wide as a line on both sides of it', () => {
    const mask = groundMaskOf(TILE_SIZE_M, {
      areas: [],
      lines: [
        {
          points: [
            { x: 0, y: -50 },
            { x: 50, y: -50 },
            { x: 50, y: 0 },
          ],
          halfWidthM: 4,
        },
      ],
    });

    expect(isGroundFree({ x: 20, y: -47 }, 0, mask)).toBe(false);
    expect(isGroundFree({ x: 53, y: -20 }, 0, mask)).toBe(false);
    expect(isGroundFree({ x: 20, y: -60 }, 0, mask)).toBe(true);
    expect(isGroundFree({ x: 70, y: -50 }, 0, mask)).toBe(true);
  });

  it('counts a disc as blocked when its rim reaches taken ground', () => {
    const mask = groundMaskOf(TILE_SIZE_M, { areas: POND_WITH_ISLAND, lines: [] });

    expect(isGroundFree({ x: 15, y: -50 }, 0, mask)).toBe(true);
    expect(isGroundFree({ x: 15, y: -50 }, 8, mask)).toBe(false);
  });

  it('ignores whatever lies beyond the tile square', () => {
    const mask = groundMaskOf(TILE_SIZE_M, {
      areas: [
        {
          outer: [
            { x: -50, y: 50 },
            { x: -50, y: -150 },
            { x: 150, y: -150 },
            { x: 150, y: 50 },
          ],
          holes: [],
        },
      ],
      lines: [],
    });

    expect(isGroundFree({ x: 1, y: -1 }, 0, mask)).toBe(false);
    expect(isGroundFree({ x: 99, y: -99 }, 0, mask)).toBe(false);
  });
});
