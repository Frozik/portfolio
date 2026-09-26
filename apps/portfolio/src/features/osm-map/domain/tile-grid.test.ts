import { EARTH_CIRCUMFERENCE_M } from './constants';
import { metresPerUnitAt, tileGridOf, toPlan } from './tile-grid';

describe('tile grid', () => {
  it('scales the map unit to the ground: the whole equator at the equator, half of it near 60° north', () => {
    expect(metresPerUnitAt({ z: 0, x: 0, y: 0 })).toBeCloseTo(EARTH_CIRCUMFERENCE_M, -5);
    expect(metresPerUnitAt({ z: 14, x: 9570, y: 4760 })).toBeCloseTo(EARTH_CIRCUMFERENCE_M / 2, -5);
  });

  it('maps tile units to metres from the north-west corner with north up', () => {
    const grid = tileGridOf({ z: 14, x: 9570, y: 4760 }, 4096);
    const [corner, inside] = toPlan(
      [
        { x: 0, y: 0 },
        { x: 4096, y: 2048 },
      ],
      grid
    );

    expect(grid.tileSizeM).toBeCloseTo(1224, 0);
    expect(corner.x).toBe(0);
    expect(Math.abs(corner.y)).toBe(0);
    expect(inside.x).toBeCloseTo(grid.tileSizeM, 6);
    expect(inside.y).toBeCloseTo(-grid.tileSizeM / 2, 6);
  });
});
