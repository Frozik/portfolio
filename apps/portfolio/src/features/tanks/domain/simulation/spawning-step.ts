import { isNil } from 'lodash-es';

import {
  ENEMY_HIT_POINTS_BY_TYPE,
  ENEMY_SPAWN_TWINKLE_TICKS,
  MAX_ENEMIES_ON_FIELD,
} from '../constants';
import type { EnemyTank, WorldEvent } from '../types';
import type { WorldState } from './world-state';

function findFreeEnemySlot(enemies: readonly EnemyTank[]): number {
  for (let slot = 0; slot < MAX_ENEMIES_ON_FIELD; slot++) {
    if (!enemies.some(enemy => enemy.slot === slot)) {
      return slot;
    }
  }

  return 0;
}

export function stepSpawning(state: WorldState, events: WorldEvent[]): void {
  const { stage } = state;
  const request = stage.spawner.tick(stage.enemies.length < MAX_ENEMIES_ON_FIELD);

  if (isNil(request)) {
    return;
  }

  if (request.isPowerUpCarrier) {
    stage.powerUp = undefined;
  }

  const enemyType = stage.definition.enemyQueue[request.spawnIndex];
  const enemy: EnemyTank = {
    slot: findFreeEnemySlot(stage.enemies),
    type: enemyType,
    spawnIndex: request.spawnIndex,
    isPowerUpCarrier: request.isPowerUpCarrier,
    positionX: request.positionX,
    positionY: request.positionY,
    direction: 'down',
    movementRemainder: 0,
    hitPoints: ENEMY_HIT_POINTS_BY_TYPE[enemyType],
    twinkleTicksRemaining: ENEMY_SPAWN_TWINKLE_TICKS,
    brakeTicksRemaining: 0,
  };

  stage.enemies.push(enemy);
  events.push({
    type: 'enemy-spawned',
    slot: enemy.slot,
    enemyType,
    isPowerUpCarrier: enemy.isPowerUpCarrier,
  });
}
