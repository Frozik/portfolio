import type { BaseWallMaterial } from '../power-ups';
import { BRICK_CELL, STEEL_CELL } from '../terrain';
import type { StageState } from './stage-state';

export function applyBaseWalls(stage: StageState, material: BaseWallMaterial): void {
  if (material === stage.baseWallMaterial) {
    return;
  }

  stage.baseWallMaterial = material;

  for (const cell of stage.baseWallCells) {
    stage.terrain.setCell(cell.x, cell.y, material === 'steel' ? STEEL_CELL : BRICK_CELL);
  }
}
