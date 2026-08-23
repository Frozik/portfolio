import { describe, expect, it } from 'vitest';

import {
  carveCircle,
  carveWedge,
  computeFillRegion,
  computeTankFalls,
  createFlatHeightfield,
  createHeightfield,
  depositCircle,
  depositWedge,
  fillHollows,
  findDownhillRestColumn,
  getSolidVolume,
  getSurfaceHeight,
  isSolidAt,
} from './heightfield';

const COLUMN_COUNT = 40;
const GROUND_HEIGHT_WU = 100;
const MAX_FILL_HALF_SPAN = 20;

function createGround(heightWu = GROUND_HEIGHT_WU) {
  return createFlatHeightfield(heightWu, COLUMN_COUNT);
}

describe('createHeightfield', () => {
  it('clamps the supplied heights into the field', () => {
    const field = createHeightfield([-10, 20, 100000]);

    expect(field.map(column => column.surfaceHeight)).toEqual([0, 20, 500]);
  });
});

describe('carveCircle', () => {
  it('lowers the surface to the crater floor when the blast breaks the surface', () => {
    const { field } = carveCircle(createGround(), { x: 20.5, y: GROUND_HEIGHT_WU }, 10);

    expect(getSurfaceHeight(field, 20)).toBeCloseTo(GROUND_HEIGHT_WU - 10);
    expect(getSurfaceHeight(field, 0)).toBe(GROUND_HEIGHT_WU);
  });

  it('carves a round profile — the crater is deepest at its centre', () => {
    const { field } = carveCircle(createGround(), { x: 20.5, y: GROUND_HEIGHT_WU }, 10);

    expect(getSurfaceHeight(field, 20)).toBeLessThan(getSurfaceHeight(field, 25));
    expect(getSurfaceHeight(field, 25)).toBeLessThan(getSurfaceHeight(field, 29));
  });

  it('reports exactly the columns it changed', () => {
    const { affectedColumns } = carveCircle(createGround(), { x: 20.5, y: GROUND_HEIGHT_WU }, 5);

    expect(Math.min(...affectedColumns)).toBeGreaterThanOrEqual(15);
    expect(Math.max(...affectedColumns)).toBeLessThanOrEqual(25);
  });

  it('drops the roof instantly when the blast is buried — dirt never hangs in the air', () => {
    const buriedCenterY = 50;
    const radiusWu = 10;
    const { field } = carveCircle(createGround(), { x: 20.5, y: buriedCenterY }, radiusWu);

    expect(getSurfaceHeight(field, 20)).toBeCloseTo(GROUND_HEIGHT_WU - 2 * radiusWu);
    expect(isSolidAt(field, 20.5, buriedCenterY)).toBe(true);
  });

  it('conserves the dirt it did not remove', () => {
    const ground = createGround();
    const radiusWu = 10;
    const { field } = carveCircle(ground, { x: 20.5, y: 50 }, radiusWu);
    const removed = getSolidVolume(ground) - getSolidVolume(field);

    expect(removed / (Math.PI * radiusWu * radiusWu)).toBeCloseTo(1, 1);
  });

  it('leaves the field untouched when the blast misses the dirt entirely', () => {
    const ground = createGround();
    const { field, affectedColumns } = carveCircle(ground, { x: 20, y: 400 }, 10);

    expect(field).toBe(ground);
    expect(affectedColumns).toEqual([]);
  });
});

describe('carveWedge', () => {
  it('removes most dirt straight above the apex and nothing at the edges', () => {
    const apexY = GROUND_HEIGHT_WU - 40;
    const radiusWu = 12;
    const { field } = carveWedge(createGround(), { x: 20.5, y: apexY }, radiusWu);

    expect(getSurfaceHeight(field, 20)).toBeLessThan(getSurfaceHeight(field, 26));
    expect(getSurfaceHeight(field, 20 + radiusWu)).toBe(GROUND_HEIGHT_WU);
  });

  it('opens the column to the sky when the wedge reaches the surface', () => {
    const apexY = GROUND_HEIGHT_WU - 5;
    const { field } = carveWedge(createGround(), { x: 20.5, y: apexY }, 20);

    expect(getSurfaceHeight(field, 20)).toBeCloseTo(apexY);
  });
});

describe('depositCircle', () => {
  it('piles the whole chord onto the surface', () => {
    const radiusWu = 10;
    const { field } = depositCircle(createGround(), { x: 20.5, y: GROUND_HEIGHT_WU }, radiusWu);

    expect(getSurfaceHeight(field, 20)).toBeCloseTo(GROUND_HEIGHT_WU + 2 * radiusWu);
  });

  it('adds the sphere volume to the field', () => {
    const ground = createGround();
    const radiusWu = 10;
    const { field } = depositCircle(ground, { x: 20.5, y: GROUND_HEIGHT_WU }, radiusWu);

    const added = getSolidVolume(field) - getSolidVolume(ground);

    expect(added / (Math.PI * radiusWu * radiusWu)).toBeCloseTo(1, 1);
  });
});

describe('depositWedge', () => {
  it('drops the most dirt over the apex', () => {
    const radiusWu = 12;
    const { field } = depositWedge(createGround(), { x: 20.5, y: GROUND_HEIGHT_WU }, radiusWu);

    expect(getSurfaceHeight(field, 20)).toBeCloseTo(GROUND_HEIGHT_WU + radiusWu);
    expect(getSurfaceHeight(field, 20 + radiusWu)).toBe(GROUND_HEIGHT_WU);
  });
});

describe('computeFillRegion and fillHollows', () => {
  it('finds the level that holds the poured volume', () => {
    const heights = Array.from({ length: COLUMN_COUNT }, (_unused, index) =>
      index >= 10 && index < 20 ? 50 : GROUND_HEIGHT_WU
    );
    const region = computeFillRegion(createHeightfield(heights), 15, 100, MAX_FILL_HALF_SPAN);

    expect(region.firstColumn).toBe(10);
    expect(region.lastColumn).toBe(19);
    expect(region.levelWu).toBeCloseTo(60);
  });

  it('flattens the hollow it fills', () => {
    const heights = Array.from({ length: COLUMN_COUNT }, (_unused, index) =>
      index >= 10 && index < 20 ? 50 : GROUND_HEIGHT_WU
    );
    const { field } = fillHollows(createHeightfield(heights), 15, 100, MAX_FILL_HALF_SPAN);

    expect(getSurfaceHeight(field, 10)).toBeCloseTo(60);
    expect(getSurfaceHeight(field, 19)).toBeCloseTo(60);
    expect(getSurfaceHeight(field, 25)).toBe(GROUND_HEIGHT_WU);
  });
});

describe('findDownhillRestColumn', () => {
  it('rolls into the valley', () => {
    const heights = Array.from(
      { length: COLUMN_COUNT },
      (_unused, index) => Math.abs(index - 12) + 10
    );

    expect(findDownhillRestColumn(createHeightfield(heights), 30, COLUMN_COUNT)).toBe(12);
  });

  it('stays put on a flat field', () => {
    expect(findDownhillRestColumn(createGround(), 7, COLUMN_COUNT)).toBe(7);
  });
});

describe('computeTankFalls', () => {
  it('drops a tank whose column collapsed', () => {
    const { field } = carveCircle(createGround(), { x: 20.5, y: 50 }, 10);
    const [fall] = computeTankFalls(field, [
      { playerId: 1, columnIndex: 20, positionY: GROUND_HEIGHT_WU },
    ]);

    expect(fall.toY).toBeCloseTo(GROUND_HEIGHT_WU - 20);
    expect(fall.fallDistanceWu).toBeCloseTo(20);
  });

  it('leaves tanks on untouched columns alone', () => {
    const { field } = carveCircle(createGround(), { x: 20.5, y: 50 }, 5);

    expect(
      computeTankFalls(field, [{ playerId: 1, columnIndex: 39, positionY: GROUND_HEIGHT_WU }])
    ).toEqual([]);
  });
});
