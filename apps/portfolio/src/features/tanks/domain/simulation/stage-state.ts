import { assert } from '@frozik/utils/assert/assert';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { FieldGeometry, PowerUpGrid } from '../field';
import {
  createFieldGeometry,
  createPowerUpGrid,
  findBaseCell,
  getBaseWallCells,
  getEnemySpawnPositionsX,
  getPlayerSpawnPositions,
} from '../field';
import { getStageByNumber } from '../levels/registry';
import type { BaseWallMaterial } from '../power-ups';
import { computeSpawnIntervalTicks, EnemySpawnScheduler } from '../spawning';
import { Terrain } from '../terrain';
import type { Bullet, EnemyTank, PowerUpDrop, StageDefinition } from '../types';

/** Everything that starts over with each stage; the campaign state around it carries on. */
export interface StageState {
  readonly definition: StageDefinition;
  readonly terrain: Terrain;
  readonly baseCell: Vector2;
  readonly baseWallCells: readonly Vector2[];
  readonly playerSpawnPositions: readonly Vector2[];
  readonly powerUpGrid: PowerUpGrid;
  readonly spawner: EnemySpawnScheduler;
  readonly spawnIntervalTicks: number;
  enemies: EnemyTank[];
  bullets: Bullet[];
  powerUp: PowerUpDrop | undefined;
  freezeTicksRemaining: number;
  shovelTicksRemaining: number;
  baseWallMaterial: BaseWallMaterial;
  ticks: number;
  isStartPending: boolean;
  isPreviousFirePressed: boolean;
}

function resolveBaseCell(definition: StageDefinition, geometry: FieldGeometry): Vector2 {
  const baseCell = findBaseCell(definition.terrain, geometry);

  assert(!isNil(baseCell), `stage ${definition.stageNumber} has no eagle on its map`);

  return baseCell;
}

export function createStageState(stageNumber: number, loopNumber: number): StageState {
  const definition = getStageByNumber(stageNumber);
  const geometry = createFieldGeometry(definition.fieldWidthTiles, definition.fieldHeightTiles);
  const baseCell = resolveBaseCell(definition, geometry);
  const spawnIntervalTicks = computeSpawnIntervalTicks(stageNumber, loopNumber);

  return {
    definition,
    terrain: new Terrain(definition.terrain, geometry),
    baseCell,
    baseWallCells: getBaseWallCells(geometry, baseCell),
    playerSpawnPositions: getPlayerSpawnPositions(geometry, baseCell),
    powerUpGrid: createPowerUpGrid(geometry),
    spawner: new EnemySpawnScheduler(spawnIntervalTicks, getEnemySpawnPositionsX(geometry)),
    spawnIntervalTicks,
    enemies: [],
    bullets: [],
    powerUp: undefined,
    freezeTicksRemaining: 0,
    shovelTicksRemaining: 0,
    baseWallMaterial: 'brick',
    ticks: 0,
    isStartPending: true,
    isPreviousFirePressed: false,
  };
}
