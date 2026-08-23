import { describe, expect, it } from 'vitest';

import { CELL_QUADRANT_SIZE_WU, CELL_SIZE_WU, TANK_SIZE_WU } from './constants';
import { createFieldGeometry, getFieldCellCount } from './field';
import type { BulletImpact } from './terrain';
import {
  BRICK_CELL,
  createTerrainCell,
  EAGLE_CELL,
  EMPTY_CELL,
  hasAnyQuadrant,
  ICE_CELL,
  STEEL_CELL,
  Terrain,
  TREES_CELL,
  WATER_CELL,
} from './terrain';
import type { Direction, QuadrantSelection, TerrainCell } from './types';

const TEST_FIELD_TILES = 13;
const TEST_GEOMETRY = createFieldGeometry(TEST_FIELD_TILES, TEST_FIELD_TILES);
const WALL_CELL_X = 2;
const TOP_WALL_CELL_Y = 2;
const BOTTOM_WALL_CELL_Y = 3;
/** Center of a tank sitting at y = 16, i.e. a strip covering cell rows 2 and 3. */
const STRIP_CENTER_WU = TOP_WALL_CELL_Y * CELL_SIZE_WU + TANK_SIZE_WU / 2;

const NO_QUADRANTS: QuadrantSelection = {
  topLeft: false,
  topRight: false,
  bottomLeft: false,
  bottomRight: false,
};

const RIGHT_COLUMN_ONLY: QuadrantSelection = {
  ...NO_QUADRANTS,
  topRight: true,
  bottomRight: true,
};

function quadrantsOf(cell: TerrainCell): QuadrantSelection {
  return {
    topLeft: cell.topLeft,
    topRight: cell.topRight,
    bottomLeft: cell.bottomLeft,
    bottomRight: cell.bottomRight,
  };
}

function createTerrain(overrides: ReadonlyMap<string, TerrainCell> = new Map()): Terrain {
  const cells: TerrainCell[] = new Array<TerrainCell>(getFieldCellCount(TEST_GEOMETRY)).fill(
    EMPTY_CELL
  );

  for (const [key, cell] of overrides) {
    const [cellX, cellY] = key.split(':').map(Number);
    cells[cellY * TEST_GEOMETRY.cellColumns + cellX] = cell;
  }

  return new Terrain(cells, TEST_GEOMETRY);
}

function createWall(cell: TerrainCell, cellX = WALL_CELL_X): Terrain {
  return createTerrain(
    new Map([
      [`${cellX}:${TOP_WALL_CELL_Y}`, cell],
      [`${cellX}:${BOTTOM_WALL_CELL_Y}`, cell],
    ])
  );
}

function createBlock(cell: TerrainCell): Terrain {
  return createTerrain(
    new Map([
      [`${WALL_CELL_X}:${TOP_WALL_CELL_Y}`, cell],
      [`${WALL_CELL_X}:${BOTTOM_WALL_CELL_Y}`, cell],
      [`${WALL_CELL_X + 1}:${TOP_WALL_CELL_Y}`, cell],
      [`${WALL_CELL_X + 1}:${BOTTOM_WALL_CELL_Y}`, cell],
    ])
  );
}

function hitFromLeft(leadingEdgeWu: number, piercing = false): BulletImpact {
  return {
    direction: 'right' as Direction,
    leadingEdgeWu,
    perpendicularCenterWu: STRIP_CENTER_WU,
    piercing,
  };
}

describe('terrain cells', () => {
  it('describes quadrants with named booleans', () => {
    const cell = createTerrainCell('brick', RIGHT_COLUMN_ONLY);

    expect(cell.kind).toBe('brick');
    expect(quadrantsOf(cell)).toEqual(RIGHT_COLUMN_ONLY);
    expect(hasAnyQuadrant(cell)).toBe(true);
    expect(hasAnyQuadrant(EMPTY_CELL)).toBe(false);
  });

  it('reports everything outside the field as border', () => {
    const terrain = createTerrain();

    expect(terrain.getKind(-1, 0)).toBe('border');
    expect(terrain.getKind(0, TEST_GEOMETRY.cellRows)).toBe('border');
    expect(terrain.blocksTank(-1, 0)).toBe(true);
  });

  it('rejects grids of the wrong size', () => {
    expect(() => new Terrain([EMPTY_CELL], TEST_GEOMETRY)).toThrow(/terrain must hold/);
  });
});

describe('Terrain tank passability', () => {
  it('lets tanks through empty, ice and trees', () => {
    const terrain = createTerrain(
      new Map([
        ['0:0', ICE_CELL],
        ['1:0', TREES_CELL],
      ])
    );

    expect(terrain.isBoxBlockedForTank(0, 0, TANK_SIZE_WU)).toBe(false);
  });

  it('blocks tanks on water, steel and the eagle', () => {
    for (const cell of [WATER_CELL, STEEL_CELL, EAGLE_CELL]) {
      const terrain = createTerrain(new Map([['1:1', cell]]));

      expect(terrain.isBoxBlockedForTank(0, 0, TANK_SIZE_WU)).toBe(true);
    }
  });

  it('keeps blocking while any brick quadrant remains', () => {
    const terrain = createTerrain(
      new Map([['1:1', createTerrainCell('brick', { ...NO_QUADRANTS, bottomRight: true })]])
    );

    expect(terrain.isBoxBlockedForTank(0, 0, TANK_SIZE_WU)).toBe(true);
  });

  it('detects the ice a tank stands on', () => {
    const terrain = createTerrain(new Map([['2:2', ICE_CELL]]));

    expect(terrain.isBoxOverKind(16, 16, TANK_SIZE_WU, 'ice')).toBe(true);
    expect(terrain.isBoxOverKind(0, 0, TANK_SIZE_WU, 'ice')).toBe(false);
  });
});

describe('Terrain bullet impact on brick', () => {
  it('removes a 16 × 4 wu strip: the near quadrant column of both adjacent cells', () => {
    const terrain = createWall(BRICK_CELL);

    const result = terrain.applyBulletImpact(hitFromLeft(WALL_CELL_X * CELL_SIZE_WU));

    expect(result).toEqual({
      blocked: true,
      hitBorder: false,
      hitSteel: false,
      hitEagle: false,
      destroyedTerrain: true,
    });
    expect(quadrantsOf(terrain.getCell(WALL_CELL_X, TOP_WALL_CELL_Y))).toEqual(RIGHT_COLUMN_ONLY);
    expect(quadrantsOf(terrain.getCell(WALL_CELL_X, BOTTOM_WALL_CELL_Y))).toEqual(
      RIGHT_COLUMN_ONLY
    );
  });

  it('clears the far quadrant column on the second hit — an 8 wu wall takes 2 hits', () => {
    const terrain = createWall(BRICK_CELL);
    const cellLeftEdge = WALL_CELL_X * CELL_SIZE_WU;

    terrain.applyBulletImpact(hitFromLeft(cellLeftEdge));
    const secondHit = terrain.applyBulletImpact(hitFromLeft(cellLeftEdge + CELL_QUADRANT_SIZE_WU));

    expect(secondHit.blocked).toBe(true);
    expect(terrain.getKind(WALL_CELL_X, TOP_WALL_CELL_Y)).toBe('empty');
    expect(terrain.getKind(WALL_CELL_X, BOTTOM_WALL_CELL_Y)).toBe('empty');
  });

  it('takes 4 hits to break through a 16 wu block from the same side', () => {
    const terrain = createBlock(BRICK_CELL);

    let hitCount = 0;
    for (
      let leadingEdge = WALL_CELL_X * CELL_SIZE_WU;
      leadingEdge < (WALL_CELL_X + 2) * CELL_SIZE_WU;
      leadingEdge += CELL_QUADRANT_SIZE_WU
    ) {
      const result = terrain.applyBulletImpact(hitFromLeft(leadingEdge));

      expect(result.blocked).toBe(true);
      hitCount++;
    }

    expect(hitCount).toBe(4);
    expect(terrain.getKind(WALL_CELL_X, TOP_WALL_CELL_Y)).toBe('empty');
    expect(terrain.getKind(WALL_CELL_X + 1, BOTTOM_WALL_CELL_Y)).toBe('empty');
  });

  it('flies through a quadrant column that is already gone', () => {
    const terrain = createWall(createTerrainCell('brick', RIGHT_COLUMN_ONLY));

    const result = terrain.applyBulletImpact(hitFromLeft(WALL_CELL_X * CELL_SIZE_WU));

    expect(result.blocked).toBe(false);
    expect(quadrantsOf(terrain.getCell(WALL_CELL_X, TOP_WALL_CELL_Y))).toEqual(RIGHT_COLUMN_ONLY);
  });

  it('clears the near row when the bullet flies vertically', () => {
    const terrain = createTerrain(
      new Map([
        ['2:4', BRICK_CELL],
        ['3:4', BRICK_CELL],
      ])
    );

    const result = terrain.applyBulletImpact({
      direction: 'down',
      leadingEdgeWu: 4 * CELL_SIZE_WU,
      perpendicularCenterWu: 2 * CELL_SIZE_WU + TANK_SIZE_WU / 2,
      piercing: false,
    });

    expect(result.blocked).toBe(true);
    expect(quadrantsOf(terrain.getCell(2, 4))).toEqual({
      topLeft: false,
      topRight: false,
      bottomLeft: true,
      bottomRight: true,
    });
    expect(quadrantsOf(terrain.getCell(3, 4))).toEqual({
      topLeft: false,
      topRight: false,
      bottomLeft: true,
      bottomRight: true,
    });
  });

  it('bumps the revision only when a cell actually changes', () => {
    const terrain = createWall(BRICK_CELL);
    const initialRevision = terrain.revision;

    terrain.applyBulletImpact(hitFromLeft(WALL_CELL_X * CELL_SIZE_WU));
    const afterDamage = terrain.revision;
    terrain.applyBulletImpact(hitFromLeft(WALL_CELL_X * CELL_SIZE_WU));

    expect(afterDamage).toBeGreaterThan(initialRevision);
    expect(terrain.revision).toBe(afterDamage);
  });

  it('never mutates the shared cell records the stage data is built from', () => {
    const terrain = createWall(BRICK_CELL);

    terrain.applyBulletImpact(hitFromLeft(WALL_CELL_X * CELL_SIZE_WU));

    expect(quadrantsOf(BRICK_CELL)).toEqual({
      topLeft: true,
      topRight: true,
      bottomLeft: true,
      bottomRight: true,
    });
  });
});

describe('Terrain bullet impact on steel', () => {
  it('stops normal bullets without damage', () => {
    const terrain = createWall(STEEL_CELL);

    const result = terrain.applyBulletImpact(hitFromLeft(WALL_CELL_X * CELL_SIZE_WU));

    expect(result.blocked).toBe(true);
    expect(result.hitSteel).toBe(true);
    expect(result.destroyedTerrain).toBe(false);
    expect(terrain.getKind(WALL_CELL_X, TOP_WALL_CELL_Y)).toBe('steel');
  });

  it('is wiped whole-cell by a piercing bullet', () => {
    const terrain = createWall(STEEL_CELL);

    const result = terrain.applyBulletImpact(hitFromLeft(WALL_CELL_X * CELL_SIZE_WU, true));

    expect(result.blocked).toBe(true);
    expect(result.hitSteel).toBe(false);
    expect(result.destroyedTerrain).toBe(true);
    expect(terrain.getKind(WALL_CELL_X, TOP_WALL_CELL_Y)).toBe('empty');
    expect(terrain.getKind(WALL_CELL_X, BOTTOM_WALL_CELL_Y)).toBe('empty');
  });
});

describe('Terrain piercing bullets', () => {
  it('clears a whole brick cell per hit — a 16 wu block takes 2 hits', () => {
    const terrain = createBlock(BRICK_CELL);

    terrain.applyBulletImpact(hitFromLeft(WALL_CELL_X * CELL_SIZE_WU, true));
    expect(terrain.getKind(WALL_CELL_X, TOP_WALL_CELL_Y)).toBe('empty');

    terrain.applyBulletImpact(hitFromLeft((WALL_CELL_X + 1) * CELL_SIZE_WU, true));
    expect(terrain.getKind(WALL_CELL_X + 1, BOTTOM_WALL_CELL_Y)).toBe('empty');
  });
});

describe('Terrain bullet impact on other blocks', () => {
  it('flies over water, ice and trees', () => {
    const terrain = createTerrain(
      new Map([
        [`${WALL_CELL_X}:${TOP_WALL_CELL_Y}`, WATER_CELL],
        [`${WALL_CELL_X}:${BOTTOM_WALL_CELL_Y}`, TREES_CELL],
      ])
    );

    const result = terrain.applyBulletImpact(hitFromLeft(WALL_CELL_X * CELL_SIZE_WU));

    expect(result.blocked).toBe(false);
    expect(terrain.getKind(WALL_CELL_X, TOP_WALL_CELL_Y)).toBe('water');
  });

  it('reports an eagle hit without damaging the cell', () => {
    const terrain = createWall(EAGLE_CELL);

    const result = terrain.applyBulletImpact(hitFromLeft(WALL_CELL_X * CELL_SIZE_WU));

    expect(result.hitEagle).toBe(true);
    expect(result.blocked).toBe(true);
    expect(terrain.getKind(WALL_CELL_X, TOP_WALL_CELL_Y)).toBe('eagle');
  });

  it('keeps the field border indestructible, even for piercing bullets', () => {
    const terrain = createTerrain();

    const outside = terrain.applyBulletImpact({
      direction: 'right',
      leadingEdgeWu: TEST_GEOMETRY.widthWu,
      perpendicularCenterWu: STRIP_CENTER_WU,
      piercing: true,
    });

    expect(outside).toEqual({
      blocked: true,
      hitBorder: true,
      hitSteel: false,
      hitEagle: false,
      destroyedTerrain: false,
    });
  });
});

describe('Terrain impact strip alignment', () => {
  it('spans exactly the two cells under a tank-aligned bullet', () => {
    const terrain = createTerrain(
      new Map([
        [`${WALL_CELL_X}:1`, BRICK_CELL],
        [`${WALL_CELL_X}:${TOP_WALL_CELL_Y}`, BRICK_CELL],
        [`${WALL_CELL_X}:${BOTTOM_WALL_CELL_Y}`, BRICK_CELL],
        [`${WALL_CELL_X}:4`, BRICK_CELL],
      ])
    );

    terrain.applyBulletImpact(hitFromLeft(WALL_CELL_X * CELL_SIZE_WU));

    expect(terrain.getCell(WALL_CELL_X, 1)).toBe(BRICK_CELL);
    expect(quadrantsOf(terrain.getCell(WALL_CELL_X, TOP_WALL_CELL_Y))).toEqual(RIGHT_COLUMN_ONLY);
    expect(quadrantsOf(terrain.getCell(WALL_CELL_X, BOTTOM_WALL_CELL_Y))).toEqual(
      RIGHT_COLUMN_ONLY
    );
    expect(terrain.getCell(WALL_CELL_X, 4)).toBe(BRICK_CELL);
  });

  it('clears the right column when the bullet flies left', () => {
    const terrain = createWall(BRICK_CELL);

    const result = terrain.applyBulletImpact({
      direction: 'left',
      leadingEdgeWu: (WALL_CELL_X + 1) * CELL_SIZE_WU - 1,
      perpendicularCenterWu: STRIP_CENTER_WU,
      piercing: false,
    });

    expect(result.blocked).toBe(true);
    expect(quadrantsOf(terrain.getCell(WALL_CELL_X, TOP_WALL_CELL_Y))).toEqual({
      ...NO_QUADRANTS,
      topLeft: true,
      bottomLeft: true,
    });
  });
});
