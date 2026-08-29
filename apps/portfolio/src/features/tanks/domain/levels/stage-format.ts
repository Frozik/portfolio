import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import { ENEMIES_PER_STAGE, TILE_CELL_SPAN } from '../constants';
import {
  BRICK_CELL,
  EAGLE_CELL,
  EMPTY_CELL,
  ICE_CELL,
  STEEL_CELL,
  TREES_CELL,
  WATER_CELL,
} from '../terrain';
import type { EnemyType, StageDefinition, TerrainCell } from '../types';

/** Map legend, one character per 8-wu cell. `border` is never stored, so it has no symbol. */
const CELL_BY_SYMBOL: Readonly<Record<string, TerrainCell | undefined>> = {
  '.': EMPTY_CELL,
  b: BRICK_CELL,
  S: STEEL_CELL,
  '~': WATER_CELL,
  i: ICE_CELL,
  f: TREES_CELL,
  E: EAGLE_CELL,
};

const ENEMY_TYPE_BY_SYMBOL: Readonly<Record<string, EnemyType | undefined>> = {
  b: 'basic',
  f: 'fast',
  p: 'power',
  a: 'armor',
};

export interface StageMapSource {
  readonly stageNumber: number;
  /** One string per cell row, row-major; the tile dimensions follow from the row sizes. */
  readonly terrainRows: readonly string[];
  /** Spawn order, one character per enemy. */
  readonly enemyQueue: string;
}

function parseEnemyQueue(stageNumber: number, enemyQueue: string): EnemyType[] {
  assert(
    enemyQueue.length === ENEMIES_PER_STAGE,
    `stage ${stageNumber}: enemy queue holds ${enemyQueue.length} entries, expected ${ENEMIES_PER_STAGE}`
  );

  return [...enemyQueue].map(symbol => {
    const enemyType = ENEMY_TYPE_BY_SYMBOL[symbol];

    assert(!isNil(enemyType), `stage ${stageNumber}: unknown enemy symbol "${symbol}"`);

    return enemyType;
  });
}

export function parseStageMap(source: StageMapSource): StageDefinition {
  const { stageNumber, terrainRows, enemyQueue } = source;
  const cellRows = terrainRows.length;

  assert(
    cellRows > 0 && cellRows % TILE_CELL_SPAN === 0,
    `stage ${stageNumber}: ${cellRows} cell rows do not fill whole tiles`
  );

  const cellColumns = terrainRows[0].length;

  assert(
    cellColumns > 0 && cellColumns % TILE_CELL_SPAN === 0,
    `stage ${stageNumber}: ${cellColumns} cell columns do not fill whole tiles`
  );

  const terrain: TerrainCell[] = [];

  for (const row of terrainRows) {
    assert(
      row.length === cellColumns,
      `stage ${stageNumber}: row "${row}" is ${row.length} cells wide, expected ${cellColumns}`
    );

    for (const symbol of row) {
      const cell = CELL_BY_SYMBOL[symbol];

      assert(!isNil(cell), `stage ${stageNumber}: unknown terrain symbol "${symbol}"`);

      terrain.push(cell);
    }
  }

  return {
    stageNumber,
    fieldWidthTiles: cellColumns / TILE_CELL_SPAN,
    fieldHeightTiles: cellRows / TILE_CELL_SPAN,
    terrain,
    enemyQueue: parseEnemyQueue(stageNumber, enemyQueue),
  };
}
