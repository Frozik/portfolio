import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';
import { CELL_SIZE_WU, MIN_FIELD_TILES, TILE_CELL_SPAN } from './constants';
import {
  createFieldGeometry,
  createPowerUpGrid,
  findBaseCell,
  getBaseCenter,
  getBaseWallCells,
  getEnemySpawnPositionsX,
  getFieldCellCount,
  getPlayerSpawnPositions,
} from './field';
import { EAGLE_CELL, EMPTY_CELL } from './terrain';

import type { TerrainCell } from './types';

const ORIGINAL_FIELD_TILES = 13;
const ORIGINAL_GEOMETRY = createFieldGeometry(ORIGINAL_FIELD_TILES, ORIGINAL_FIELD_TILES);
const ORIGINAL_BASE_CELL: Vector2 = { x: 12, y: 24 };

function createTerrainWithBase(baseCell: Vector2): readonly TerrainCell[] {
  const cells: TerrainCell[] = new Array<TerrainCell>(getFieldCellCount(ORIGINAL_GEOMETRY)).fill(
    EMPTY_CELL
  );

  for (let offsetY = 0; offsetY < TILE_CELL_SPAN; offsetY++) {
    for (let offsetX = 0; offsetX < TILE_CELL_SPAN; offsetX++) {
      const index = (baseCell.y + offsetY) * ORIGINAL_GEOMETRY.cellColumns + baseCell.x + offsetX;
      cells[index] = EAGLE_CELL;
    }
  }

  return cells;
}

describe('createFieldGeometry', () => {
  it('derives cell and world-unit sizes from the tile dimensions', () => {
    const geometry = createFieldGeometry(13, 9);

    expect(geometry).toEqual({
      widthTiles: 13,
      heightTiles: 9,
      cellColumns: 26,
      cellRows: 18,
      widthWu: 208,
      heightWu: 144,
    });
    expect(getFieldCellCount(geometry)).toBe(26 * 18);
  });

  it('rejects fields below the minimum playable size', () => {
    expect(() => createFieldGeometry(MIN_FIELD_TILES - 1, MIN_FIELD_TILES)).toThrow(
      /field width must be at least/
    );
    expect(() => createFieldGeometry(MIN_FIELD_TILES, MIN_FIELD_TILES - 1)).toThrow(
      /field height must be at least/
    );
  });
});

describe('getEnemySpawnPositionsX', () => {
  it('reproduces the original corner/center spawn points on a 13-tile field', () => {
    expect(getEnemySpawnPositionsX(ORIGINAL_GEOMETRY)).toEqual([0, 96, 192]);
  });

  it('keeps the spawn points on the 8 wu grid and inside any field', () => {
    const geometry = createFieldGeometry(MIN_FIELD_TILES, MIN_FIELD_TILES);

    for (const positionX of getEnemySpawnPositionsX(geometry)) {
      expect(positionX % 8).toBe(0);
      expect(positionX).toBeGreaterThanOrEqual(0);
      expect(positionX).toBeLessThanOrEqual(geometry.widthWu - 16);
    }
  });
});

describe('createPowerUpGrid', () => {
  it('anchors the ROM 4 × 4 spots to the field origin on a 13-tile field', () => {
    expect(createPowerUpGrid(ORIGINAL_GEOMETRY)).toEqual({
      columnsWu: [32, 80, 128, 176],
      rowsWu: [40, 88, 136, 184],
    });
  });

  it('never places a spot on the base row', () => {
    const grid = createPowerUpGrid(ORIGINAL_GEOMETRY);

    for (const positionY of grid.rowsWu) {
      expect(positionY).toBeLessThan(ORIGINAL_BASE_CELL.y * CELL_SIZE_WU);
    }
  });

  it('keeps every spot inside a smaller field', () => {
    const geometry = createFieldGeometry(MIN_FIELD_TILES, MIN_FIELD_TILES);
    const grid = createPowerUpGrid(geometry);

    for (const positionWu of [...grid.columnsWu, ...grid.rowsWu]) {
      expect(positionWu).toBeGreaterThanOrEqual(0);
      expect(positionWu).toBeLessThanOrEqual(geometry.widthWu - 16);
    }
  });
});

describe('findBaseCell', () => {
  it('finds the top-left cell of the eagle block', () => {
    const terrain = createTerrainWithBase(ORIGINAL_BASE_CELL);

    expect(findBaseCell(terrain, ORIGINAL_GEOMETRY)).toEqual(ORIGINAL_BASE_CELL);
  });

  it('returns undefined when the map has no eagle', () => {
    const terrain = new Array<TerrainCell>(getFieldCellCount(ORIGINAL_GEOMETRY)).fill(EMPTY_CELL);

    expect(findBaseCell(terrain, ORIGINAL_GEOMETRY)).toBeUndefined();
  });
});

describe('getPlayerSpawnPositions', () => {
  it('places the players two tiles either side of the base', () => {
    expect(getPlayerSpawnPositions(ORIGINAL_GEOMETRY, ORIGINAL_BASE_CELL)).toEqual([
      { x: 64, y: 192 },
      { x: 128, y: 192 },
    ]);
  });

  it('clamps the spawns into the field when the base sits in a corner', () => {
    const positions = getPlayerSpawnPositions(ORIGINAL_GEOMETRY, { x: 0, y: 0 });

    for (const position of positions) {
      expect(position.x).toBeGreaterThanOrEqual(0);
      expect(position.x).toBeLessThanOrEqual(ORIGINAL_GEOMETRY.widthWu - 16);
      expect(position.y).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('getBaseWallCells', () => {
  it('rings the eagle with eight cells at the bottom edge of the field', () => {
    expect(getBaseWallCells(ORIGINAL_GEOMETRY, ORIGINAL_BASE_CELL)).toEqual([
      { x: 11, y: 23 },
      { x: 12, y: 23 },
      { x: 13, y: 23 },
      { x: 14, y: 23 },
      { x: 11, y: 24 },
      { x: 14, y: 24 },
      { x: 11, y: 25 },
      { x: 14, y: 25 },
    ]);
  });

  it('drops cells that fall outside the field', () => {
    const cells = getBaseWallCells(ORIGINAL_GEOMETRY, { x: 0, y: 0 });

    for (const cell of cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.y).toBeGreaterThanOrEqual(0);
    }
    expect(cells).toHaveLength(5);
  });
});

describe('getBaseCenter', () => {
  it('returns the center of the eagle tile in world units', () => {
    expect(getBaseCenter(ORIGINAL_BASE_CELL)).toEqual({ x: 104, y: 200 });
  });
});
