import { assert } from '@frozik/utils/assert/assert';

import {
  ENEMIES_PER_STAGE,
  ENEMY_SPAWN_POSITION_Y_WU,
  POWER_UP_CARRIER_SPAWN_INDICES,
  SPAWN_INTERVAL_BASE_TICKS,
  SPAWN_INTERVAL_LOOPED_TICKS,
  SPAWN_INTERVAL_PER_STAGE_TICKS,
} from './constants';

export interface EnemySpawnRequest {
  readonly spawnIndex: number;
  readonly positionX: number;
  readonly positionY: number;
  readonly isPowerUpCarrier: boolean;
}

/** `I = 190 − 4 × stage` on the first pass through the campaign, a flat 50 from loop 2 on. */
export function computeSpawnIntervalTicks(stageNumber: number, loopNumber: number): number {
  if (loopNumber > 1) {
    return SPAWN_INTERVAL_LOOPED_TICKS;
  }

  return SPAWN_INTERVAL_BASE_TICKS - SPAWN_INTERVAL_PER_STAGE_TICKS * stageNumber;
}

export function isPowerUpCarrierSpawnIndex(spawnIndex: number): boolean {
  return POWER_UP_CARRIER_SPAWN_INDICES.includes(spawnIndex);
}

/** The timer starts expired; an expired timer that finds every slot busy retries without reloading. */
export class EnemySpawnScheduler {
  private readonly intervalTicks: number;
  private readonly spawnPositionsX: readonly number[];
  private timerTicks = 0;
  private spawnedCountValue = 0;

  constructor(intervalTicks: number, spawnPositionsX: readonly number[]) {
    assert(spawnPositionsX.length > 0, 'a stage needs at least one enemy spawn point');

    this.intervalTicks = intervalTicks;
    this.spawnPositionsX = spawnPositionsX;
  }

  get spawnedCount(): number {
    return this.spawnedCountValue;
  }

  get hasPendingEnemies(): boolean {
    return this.spawnedCountValue < ENEMIES_PER_STAGE;
  }

  tick(hasFreeSlot: boolean): EnemySpawnRequest | undefined {
    if (!this.hasPendingEnemies) {
      return undefined;
    }

    if (this.timerTicks > 0) {
      this.timerTicks--;

      return undefined;
    }

    if (!hasFreeSlot) {
      return undefined;
    }

    const spawnIndex = this.spawnedCountValue;
    this.spawnedCountValue++;
    this.timerTicks = this.intervalTicks;

    return {
      spawnIndex,
      positionX: this.spawnPositionsX[spawnIndex % this.spawnPositionsX.length],
      positionY: ENEMY_SPAWN_POSITION_Y_WU,
      isPowerUpCarrier: isPowerUpCarrierSpawnIndex(spawnIndex),
    };
  }
}
