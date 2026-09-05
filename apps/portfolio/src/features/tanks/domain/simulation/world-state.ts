import type { Vector2 } from '@frozik/utils/math/vector2';

import { INITIAL_LIVES, MIN_STAR_LEVEL, PLAYER_SLOT_COUNT, SPAWN_SHIELD_TICKS } from '../constants';
import type { PlayerTank } from '../types';
import type { StageState } from './stage-state';
import { createStageState } from './stage-state';

export type GameStatus = 'playing' | 'stage-cleared' | 'game-over';

const FIRST_STAGE_NUMBER = 1;
const FIRST_LOOP_NUMBER = 1;

/** The campaign: what survives from stage to stage, plus the stage currently being played. */
export interface WorldState {
  stage: StageState;
  readonly players: readonly PlayerTank[];
  loopNumber: number;
  score: number;
  lives: number;
  status: GameStatus;
  isBaseDestroyed: boolean;
  isExtraLifeAwarded: boolean;
  nextBulletId: number;
}

function createPlayerTank(slot: number, isActive: boolean, spawnPosition: Vector2): PlayerTank {
  return {
    slot,
    isActive,
    positionX: spawnPosition.x,
    positionY: spawnPosition.y,
    direction: 'up',
    movementRemainder: 0,
    starLevel: MIN_STAR_LEVEL,
    shieldTicksRemaining: SPAWN_SHIELD_TICKS,
    isIceSliding: false,
    iceSlideDirection: 'up',
    iceSlideBudgetWu: 0,
  };
}

export function createWorldState(stageNumber: number = FIRST_STAGE_NUMBER): WorldState {
  const stage = createStageState(stageNumber, FIRST_LOOP_NUMBER);

  return {
    stage,
    players: Array.from({ length: PLAYER_SLOT_COUNT }, (_unused, slot) =>
      createPlayerTank(slot, slot === 0, stage.playerSpawnPositions[slot])
    ),
    loopNumber: FIRST_LOOP_NUMBER,
    score: 0,
    lives: INITIAL_LIVES,
    status: 'playing',
    isBaseDestroyed: false,
    isExtraLifeAwarded: false,
    nextBulletId: 1,
  };
}

export function placePlayerAtSpawn(state: WorldState, player: PlayerTank): void {
  const spawnPosition = state.stage.playerSpawnPositions[player.slot];

  player.positionX = spawnPosition.x;
  player.positionY = spawnPosition.y;
  player.direction = 'up';
  player.movementRemainder = 0;
  player.shieldTicksRemaining = SPAWN_SHIELD_TICKS;
  player.isIceSliding = false;
  player.iceSlideBudgetWu = 0;
}

/** Swaps in a fresh stage and puts every player back on its spawn point. */
export function beginStage(state: WorldState, stageNumber: number): void {
  state.stage = createStageState(stageNumber, state.loopNumber);
  state.status = 'playing';

  for (const player of state.players) {
    placePlayerAtSpawn(state, player);
  }
}
