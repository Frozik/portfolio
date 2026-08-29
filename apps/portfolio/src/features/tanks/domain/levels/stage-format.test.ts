import { describe, expect, it } from 'vitest';

import { ENEMIES_PER_STAGE } from '../constants';
import { BRICK_CELL, EAGLE_CELL, EMPTY_CELL, STEEL_CELL } from '../terrain';
import type { StageMapSource } from './stage-format';
import { parseStageMap } from './stage-format';

const ENEMY_QUEUE = 'b'.repeat(ENEMIES_PER_STAGE);

const TWO_TILE_STAGE: StageMapSource = {
  stageNumber: 1,
  terrainRows: ['.bSE', 'Ei~f', 'bb..', '..bb'],
  enemyQueue: ENEMY_QUEUE,
};

function withRows(terrainRows: readonly string[]): StageMapSource {
  return { ...TWO_TILE_STAGE, terrainRows };
}

describe('parseStageMap', () => {
  it('derives the tile dimensions from the cell rows', () => {
    const stage = parseStageMap(TWO_TILE_STAGE);

    expect(stage.stageNumber).toBe(1);
    expect(stage.fieldWidthTiles).toBe(2);
    expect(stage.fieldHeightTiles).toBe(2);
    expect(stage.terrain).toHaveLength(16);
  });

  it('maps every legend symbol onto the shared terrain cell', () => {
    const { terrain } = parseStageMap(TWO_TILE_STAGE);

    expect(terrain.slice(0, 4)).toEqual([EMPTY_CELL, BRICK_CELL, STEEL_CELL, EAGLE_CELL]);
    expect(terrain.slice(4, 8).map(cell => cell.kind)).toEqual(['eagle', 'ice', 'water', 'trees']);
  });

  it('reads the map row-major', () => {
    const { terrain } = parseStageMap(TWO_TILE_STAGE);

    expect(terrain[8]).toBe(BRICK_CELL);
    expect(terrain[10]).toBe(EMPTY_CELL);
  });

  it('expands the enemy queue in spawn order', () => {
    const stage = parseStageMap({
      ...TWO_TILE_STAGE,
      enemyQueue: `pfa${'b'.repeat(ENEMIES_PER_STAGE - 3)}`,
    });

    expect(stage.enemyQueue.slice(0, 4)).toEqual(['power', 'fast', 'armor', 'basic']);
    expect(stage.enemyQueue).toHaveLength(ENEMIES_PER_STAGE);
  });

  it('rejects an unknown terrain symbol', () => {
    expect(() => parseStageMap(withRows(['.b#E', 'Ei~f', 'bb..', '..bb']))).toThrow(
      /unknown terrain symbol "#"/
    );
  });

  it('rejects a ragged map', () => {
    expect(() => parseStageMap(withRows(['.bSE', 'Ei~', 'bb..', '..bb']))).toThrow(
      /is 3 cells wide, expected 4/
    );
  });

  it('rejects rows that do not fill whole tiles', () => {
    expect(() => parseStageMap(withRows(['.bSE', 'Ei~f', 'bb..']))).toThrow(
      /3 cell rows do not fill whole tiles/
    );
    expect(() => parseStageMap(withRows(['.bS', 'Ei~', 'bb.', '..b']))).toThrow(
      /3 cell columns do not fill whole tiles/
    );
  });

  it('rejects an enemy queue of the wrong length', () => {
    expect(() => parseStageMap({ ...TWO_TILE_STAGE, enemyQueue: 'bbf' })).toThrow(
      /enemy queue holds 3 entries/
    );
  });

  it('rejects an unknown enemy symbol', () => {
    expect(() =>
      parseStageMap({ ...TWO_TILE_STAGE, enemyQueue: `x${'b'.repeat(ENEMIES_PER_STAGE - 1)}` })
    ).toThrow(/unknown enemy symbol "x"/);
  });
});
