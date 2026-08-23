import { describe, expect, it } from 'vitest';

import { ENEMIES_PER_STAGE, STAGE_COUNT, TILE_CELL_SPAN } from '../constants';
import { createFieldGeometry, findBaseCell, getFieldCellCount } from '../field';
import type { TerrainCell, TerrainKind } from '../types';
import { getStageByNumber, STAGES } from './registry';

const ORIGINAL_FIELD_TILES = 13;
const ORIGINAL_CELL_COUNT = ORIGINAL_FIELD_TILES * TILE_CELL_SPAN;
const EAGLE_TILE_COLUMN = 6;
const EAGLE_TILE_ROW = 12;

const KIND_SYMBOLS: Readonly<Record<TerrainKind, string>> = {
  empty: '.',
  brick: 'b',
  steel: 'S',
  water: '~',
  ice: 'i',
  trees: 'f',
  eagle: 'E',
  border: '#',
};

function renderCellRows(terrain: readonly TerrainCell[], fromRow: number, toRow: number): string[] {
  const rows: string[] = [];

  for (let cellY = fromRow; cellY <= toRow; cellY++) {
    const row = terrain
      .slice(cellY * ORIGINAL_CELL_COUNT, (cellY + 1) * ORIGINAL_CELL_COUNT)
      .map(cell => KIND_SYMBOLS[cell.kind])
      .join('');

    rows.push(row);
  }

  return rows;
}

describe('STAGES', () => {
  it('holds all 35 original stages in order', () => {
    expect(STAGES).toHaveLength(STAGE_COUNT);
    expect(STAGES.map(stage => stage.stageNumber)).toEqual(
      Array.from({ length: STAGE_COUNT }, (_unused, index) => index + 1)
    );
  });

  it.each(STAGES)('stage $stageNumber is a full 13 × 13 tile grid with 20 enemies', stage => {
    const geometry = createFieldGeometry(stage.fieldWidthTiles, stage.fieldHeightTiles);

    expect(stage.fieldWidthTiles).toBe(ORIGINAL_FIELD_TILES);
    expect(stage.fieldHeightTiles).toBe(ORIGINAL_FIELD_TILES);
    expect(stage.terrain).toHaveLength(getFieldCellCount(geometry));
    expect(stage.enemyQueue).toHaveLength(ENEMIES_PER_STAGE);
  });

  it.each(STAGES)('stage $stageNumber places the eagle at the bottom-center tile', stage => {
    const geometry = createFieldGeometry(stage.fieldWidthTiles, stage.fieldHeightTiles);
    const eagleCellCount = stage.terrain.filter(cell => cell.kind === 'eagle').length;
    const baseCell = findBaseCell(stage.terrain, geometry);

    expect(eagleCellCount).toBe(TILE_CELL_SPAN * TILE_CELL_SPAN);
    expect(baseCell).toEqual({
      x: EAGLE_TILE_COLUMN * TILE_CELL_SPAN,
      y: EAGLE_TILE_ROW * TILE_CELL_SPAN,
    });

    for (let offsetY = 0; offsetY < TILE_CELL_SPAN; offsetY++) {
      for (let offsetX = 0; offsetX < TILE_CELL_SPAN; offsetX++) {
        const index =
          (EAGLE_TILE_ROW * TILE_CELL_SPAN + offsetY) * geometry.cellColumns +
          EAGLE_TILE_COLUMN * TILE_CELL_SPAN +
          offsetX;

        expect(stage.terrain[index].kind).toBe('eagle');
      }
    }
  });
});

describe('stage 1 layout', () => {
  it('renders the classic opening rows and the eagle nest', () => {
    const { terrain } = STAGES[0];

    expect(renderCellRows(terrain, 0, 7)).toEqual([
      '..........................',
      '..........................',
      '..bb..bb..bb..bb..bb..bb..',
      '..bb..bb..bb..bb..bb..bb..',
      '..bb..bb..bb..bb..bb..bb..',
      '..bb..bb..bb..bb..bb..bb..',
      '..bb..bb..bbSSbb..bb..bb..',
      '..bb..bb..bbSSbb..bb..bb..',
    ]);

    expect(renderCellRows(terrain, 20, 25)).toEqual([
      '..bb..bb..bb..bb..bb..bb..',
      '..bb..bb..........bb..bb..',
      '..bb..bb..........bb..bb..',
      '..bb..bb...bbbb...bb..bb..',
      '...........bEEb...........',
      '...........bEEb...........',
    ]);
  });
});

describe('getStageByNumber', () => {
  it('returns the requested stage', () => {
    expect(getStageByNumber(1).stageNumber).toBe(1);
    expect(getStageByNumber(STAGE_COUNT).stageNumber).toBe(STAGE_COUNT);
  });

  it('throws for a stage number outside the campaign', () => {
    expect(() => getStageByNumber(0)).toThrow(/unknown stage number/);
    expect(() => getStageByNumber(STAGE_COUNT + 1)).toThrow(/unknown stage number/);
  });
});
