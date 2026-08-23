import { describe, expect, it } from 'vitest';

import {
  ENEMIES_PER_STAGE,
  ENEMY_SPAWN_POSITION_Y_WU,
  POWER_UP_CARRIER_SPAWN_INDICES,
  SPAWN_INTERVAL_LOOPED_TICKS,
  STAGE_COUNT,
} from './constants';
import type { EnemySpawnRequest } from './spawning';
import {
  computeSpawnIntervalTicks,
  EnemySpawnScheduler,
  isPowerUpCarrierSpawnIndex,
} from './spawning';

const SPAWN_POSITIONS_X = [0, 96, 192];
const STAGE_ONE_INTERVAL_TICKS = 186;

function createScheduler(intervalTicks = STAGE_ONE_INTERVAL_TICKS): EnemySpawnScheduler {
  return new EnemySpawnScheduler(intervalTicks, SPAWN_POSITIONS_X);
}

function runUntilSpawn(
  scheduler: EnemySpawnScheduler,
  maxTicks: number
): { readonly request: EnemySpawnRequest | undefined; readonly ticks: number } {
  for (let tick = 1; tick <= maxTicks; tick++) {
    const request = scheduler.tick(true);

    if (request !== undefined) {
      return { request, ticks: tick };
    }
  }

  return { request: undefined, ticks: maxTicks };
}

describe('computeSpawnIntervalTicks', () => {
  it('follows I = 190 − 4 × stage on the first loop', () => {
    expect(computeSpawnIntervalTicks(1, 1)).toBe(STAGE_ONE_INTERVAL_TICKS);
    expect(computeSpawnIntervalTicks(STAGE_COUNT, 1)).toBe(50);
  });

  it('flattens to 50 ticks from the second loop on', () => {
    expect(computeSpawnIntervalTicks(1, 2)).toBe(SPAWN_INTERVAL_LOOPED_TICKS);
    expect(computeSpawnIntervalTicks(STAGE_COUNT, 3)).toBe(SPAWN_INTERVAL_LOOPED_TICKS);
  });
});

describe('isPowerUpCarrierSpawnIndex', () => {
  it('flags the 4th, 11th and 18th enemies of the queue', () => {
    for (let spawnIndex = 0; spawnIndex < ENEMIES_PER_STAGE; spawnIndex++) {
      expect(isPowerUpCarrierSpawnIndex(spawnIndex)).toBe(
        POWER_UP_CARRIER_SPAWN_INDICES.includes(spawnIndex)
      );
    }
  });
});

describe('EnemySpawnScheduler', () => {
  it('releases the first enemy immediately', () => {
    const scheduler = createScheduler();

    const request = scheduler.tick(true);

    expect(request).toEqual({
      spawnIndex: 0,
      positionX: SPAWN_POSITIONS_X[0],
      positionY: ENEMY_SPAWN_POSITION_Y_WU,
      isPowerUpCarrier: false,
    });
    expect(scheduler.spawnedCount).toBe(1);
  });

  it('waits a full interval before the next enemy', () => {
    const scheduler = createScheduler();
    scheduler.tick(true);

    const { request, ticks } = runUntilSpawn(scheduler, STAGE_ONE_INTERVAL_TICKS * 2);

    expect(request?.spawnIndex).toBe(1);
    expect(ticks).toBe(STAGE_ONE_INTERVAL_TICKS + 1);
  });

  it('retries every tick without reloading while all slots are busy', () => {
    const scheduler = createScheduler();
    scheduler.tick(true);

    for (let tick = 0; tick < STAGE_ONE_INTERVAL_TICKS; tick++) {
      scheduler.tick(false);
    }

    expect(scheduler.spawnedCount).toBe(1);
    expect(scheduler.tick(false)).toBeUndefined();
    expect(scheduler.tick(true)?.spawnIndex).toBe(1);
  });

  it('cycles the three spawn points round-robin', () => {
    const scheduler = createScheduler(0);
    const positions: number[] = [];

    for (let spawnIndex = 0; spawnIndex < 4; spawnIndex++) {
      const request = scheduler.tick(true);
      expect(request).toBeDefined();
      positions.push(request?.positionX ?? -1);
    }

    expect(positions).toEqual([
      SPAWN_POSITIONS_X[0],
      SPAWN_POSITIONS_X[1],
      SPAWN_POSITIONS_X[2],
      SPAWN_POSITIONS_X[0],
    ]);
  });

  it('marks the carrier spawn indices and stops after 20 enemies', () => {
    const scheduler = createScheduler(0);
    const carrierIndices: number[] = [];

    for (let tick = 0; tick < ENEMIES_PER_STAGE * 2; tick++) {
      const request = scheduler.tick(true);

      if (request?.isPowerUpCarrier === true) {
        carrierIndices.push(request.spawnIndex);
      }
    }

    expect(carrierIndices).toEqual([...POWER_UP_CARRIER_SPAWN_INDICES]);
    expect(scheduler.spawnedCount).toBe(ENEMIES_PER_STAGE);
    expect(scheduler.hasPendingEnemies).toBe(false);
    expect(scheduler.tick(true)).toBeUndefined();
  });

  it('needs at least one spawn point', () => {
    expect(() => new EnemySpawnScheduler(STAGE_ONE_INTERVAL_TICKS, [])).toThrow(
      /at least one enemy spawn point/
    );
  });
});
