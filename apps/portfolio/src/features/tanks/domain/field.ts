import { assert } from '@frozik/utils/assert/assert';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp } from 'lodash-es';
import {
  CELL_SIZE_WU,
  MIN_FIELD_TILES,
  PLAYER_SLOT_COUNT,
  PLAYER_SPAWN_TILE_OFFSET,
  POWER_UP_GRID_ANCHOR_OFFSET_X_WU,
  POWER_UP_GRID_ANCHOR_OFFSET_Y_WU,
  POWER_UP_GRID_STEPS,
  POWER_UP_SIZE_WU,
  TANK_SIZE_WU,
  TILE_CELL_SPAN,
  TILE_SIZE_WU,
} from './constants';

import type { TerrainCell } from './types';

/** The original 35 stages are 13 × 13, but nothing in the simulation assumes that. */
export interface FieldGeometry {
  readonly widthTiles: number;
  readonly heightTiles: number;
  readonly cellColumns: number;
  readonly cellRows: number;
  readonly widthWu: number;
  readonly heightWu: number;
}

export interface PowerUpGrid {
  readonly columnsWu: readonly number[];
  readonly rowsWu: readonly number[];
}

function snapToCellGrid(valueWu: number): number {
  return Math.round(valueWu / CELL_SIZE_WU) * CELL_SIZE_WU;
}

export function createFieldGeometry(widthTiles: number, heightTiles: number): FieldGeometry {
  assert(
    Number.isInteger(widthTiles) && widthTiles >= MIN_FIELD_TILES,
    `field width must be at least ${MIN_FIELD_TILES} tiles, got ${widthTiles}`
  );
  assert(
    Number.isInteger(heightTiles) && heightTiles >= MIN_FIELD_TILES,
    `field height must be at least ${MIN_FIELD_TILES} tiles, got ${heightTiles}`
  );

  return {
    widthTiles,
    heightTiles,
    cellColumns: widthTiles * TILE_CELL_SPAN,
    cellRows: heightTiles * TILE_CELL_SPAN,
    widthWu: widthTiles * TILE_SIZE_WU,
    heightWu: heightTiles * TILE_SIZE_WU,
  };
}

export function getFieldCellCount(geometry: FieldGeometry): number {
  return geometry.cellColumns * geometry.cellRows;
}

/** Top-row spawn points: left corner, center and right corner, all on the 8-wu grid. */
export function getEnemySpawnPositionsX(geometry: FieldGeometry): readonly number[] {
  const rightCorner = geometry.widthWu - TANK_SIZE_WU;

  return [0, snapToCellGrid(rightCorner / 2), rightCorner];
}

function createPowerUpAxis(
  tiles: number,
  fieldSizeWu: number,
  anchorOffsetWu: number
): readonly number[] {
  const stepTiles = (tiles - 1) / POWER_UP_GRID_STEPS;
  const lastPositionWu = fieldSizeWu - POWER_UP_SIZE_WU;

  return Array.from({ length: POWER_UP_GRID_STEPS }, (_unused, index) =>
    clamp(
      snapToCellGrid((index + 1) * stepTiles * TILE_SIZE_WU - anchorOffsetWu),
      0,
      lastPositionWu
    )
  );
}

/** The ROM's 4 × 4 spot grid, scaled to the stage's size and snapped onto the 8-wu grid. */
export function createPowerUpGrid(geometry: FieldGeometry): PowerUpGrid {
  return {
    columnsWu: createPowerUpAxis(
      geometry.widthTiles,
      geometry.widthWu,
      POWER_UP_GRID_ANCHOR_OFFSET_X_WU
    ),
    rowsWu: createPowerUpAxis(
      geometry.heightTiles,
      geometry.heightWu,
      POWER_UP_GRID_ANCHOR_OFFSET_Y_WU
    ),
  };
}

/** The top-left cell of the eagle block, wherever the stage map placed it. */
export function findBaseCell(
  terrain: readonly TerrainCell[],
  geometry: FieldGeometry
): Vector2 | undefined {
  const index = terrain.findIndex(cell => cell.kind === 'eagle');

  if (index < 0) {
    return undefined;
  }

  return { x: index % geometry.cellColumns, y: Math.floor(index / geometry.cellColumns) };
}

/** Players line up two tiles to either side of the base, on the base's own row. */
export function getPlayerSpawnPositions(
  geometry: FieldGeometry,
  baseCell: Vector2
): readonly Vector2[] {
  const baseTileX = Math.floor(baseCell.x / TILE_CELL_SPAN);
  const baseTileY = Math.floor(baseCell.y / TILE_CELL_SPAN);
  const positionY = clamp(baseTileY * TILE_SIZE_WU, 0, geometry.heightWu - TANK_SIZE_WU);

  return Array.from({ length: PLAYER_SLOT_COUNT }, (_unused, slot) => {
    const tileOffset = slot === 0 ? -PLAYER_SPAWN_TILE_OFFSET : PLAYER_SPAWN_TILE_OFFSET;

    return {
      x: clamp((baseTileX + tileOffset) * TILE_SIZE_WU, 0, geometry.widthWu - TANK_SIZE_WU),
      y: positionY,
    };
  });
}

/** The cells hugging the eagle block — brick by default, steel while the shovel runs. */
export function getBaseWallCells(geometry: FieldGeometry, baseCell: Vector2): readonly Vector2[] {
  const cells: Vector2[] = [];

  for (let offsetY = -1; offsetY <= TILE_CELL_SPAN; offsetY++) {
    for (let offsetX = -1; offsetX <= TILE_CELL_SPAN; offsetX++) {
      const isEagleCell =
        offsetX >= 0 && offsetX < TILE_CELL_SPAN && offsetY >= 0 && offsetY < TILE_CELL_SPAN;
      const cellX = baseCell.x + offsetX;
      const cellY = baseCell.y + offsetY;
      const isInsideField =
        cellX >= 0 && cellX < geometry.cellColumns && cellY >= 0 && cellY < geometry.cellRows;

      if (!isEagleCell && isInsideField) {
        cells.push({ x: cellX, y: cellY });
      }
    }
  }

  return cells;
}

export function getBaseCenter(baseCell: Vector2): Vector2 {
  return {
    x: baseCell.x * CELL_SIZE_WU + TILE_SIZE_WU / 2,
    y: baseCell.y * CELL_SIZE_WU + TILE_SIZE_WU / 2,
  };
}
