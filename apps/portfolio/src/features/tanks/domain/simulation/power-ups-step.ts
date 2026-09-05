import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { CELL_SIZE_WU, POWER_UP_PICKUP_POINTS, POWER_UP_SIZE_WU, TANK_SIZE_WU } from '../constants';
import { rectanglesOverlap } from '../movement';
import {
  getBaseWallMaterial,
  getPowerUpEffect,
  rollPowerUpPosition,
  rollPowerUpType,
  upgradeStarLevel,
} from '../power-ups';
import type { PlayerTank, PowerUpType, TerrainKind, WorldEvent } from '../types';
import { applyBaseWalls } from './base-walls';
import { awardScore, destroyEnemy } from './outcomes';
import { collectCollidableTanks } from './tank-queries';
import type { WorldState } from './world-state';

/** Free ground, ice and trees are all fine to drop a bonus on; these are not. */
const POWER_UP_INVALID_TERRAIN_KINDS: readonly TerrainKind[] = ['steel', 'water', 'eagle'];

function isPositionOnUnreachableTerrain(state: WorldState, position: Vector2): boolean {
  return POWER_UP_INVALID_TERRAIN_KINDS.some(kind =>
    state.stage.terrain.isBoxOverKind(position.x, position.y, POWER_UP_SIZE_WU, kind)
  );
}

function isPositionOnBaseNest(state: WorldState, position: Vector2): boolean {
  return state.stage.baseWallCells.some(cell =>
    rectanglesOverlap(
      position.x,
      position.y,
      POWER_UP_SIZE_WU,
      cell.x * CELL_SIZE_WU,
      cell.y * CELL_SIZE_WU,
      CELL_SIZE_WU
    )
  );
}

function isPositionOverTank(state: WorldState, position: Vector2): boolean {
  return collectCollidableTanks(state).some(tank =>
    rectanglesOverlap(
      position.x,
      position.y,
      POWER_UP_SIZE_WU,
      tank.positionX,
      tank.positionY,
      TANK_SIZE_WU
    )
  );
}

/** The ROM only re-rolls on tanks; we also refuse unreachable spots and the base nest. */
function isPowerUpSpotBlocked(state: WorldState, position: Vector2): boolean {
  return (
    isPositionOverTank(state, position) ||
    isPositionOnUnreachableTerrain(state, position) ||
    isPositionOnBaseNest(state, position)
  );
}

export function spawnPowerUp(state: WorldState, events: WorldEvent[]): void {
  const powerUpType = rollPowerUpType();
  const position = rollPowerUpPosition(state.stage.powerUpGrid, candidate =>
    isPowerUpSpotBlocked(state, candidate)
  );

  state.stage.powerUp = { type: powerUpType, positionX: position.x, positionY: position.y };
  events.push({ type: 'power-up-spawned', powerUpType, position });
}

function applyPowerUpEffect(
  state: WorldState,
  powerUpType: PowerUpType,
  collector: PlayerTank,
  events: WorldEvent[]
): void {
  const effect = getPowerUpEffect(powerUpType);

  switch (effect.kind) {
    case 'shield':
      collector.shieldTicksRemaining = effect.ticks;
      break;
    case 'freeze-enemies':
      state.stage.freezeTicksRemaining = effect.ticks;
      break;
    case 'fortify-base':
      state.stage.shovelTicksRemaining = effect.ticks;
      applyBaseWalls(state.stage, getBaseWallMaterial(effect.ticks));
      break;
    case 'upgrade':
      collector.starLevel = upgradeStarLevel(collector.starLevel);
      break;
    case 'destroy-all-enemies':
      for (const enemy of [...state.stage.enemies]) {
        destroyEnemy(state, enemy, false, events);
      }
      break;
    case 'extra-life':
      state.lives++;
      break;
    default:
      assertNever(effect);
  }
}

export function collectPowerUp(state: WorldState, events: WorldEvent[]): void {
  const powerUp = state.stage.powerUp;

  if (isNil(powerUp)) {
    return;
  }

  const collector = state.players.find(
    player =>
      player.isActive &&
      rectanglesOverlap(
        powerUp.positionX,
        powerUp.positionY,
        POWER_UP_SIZE_WU,
        player.positionX,
        player.positionY,
        TANK_SIZE_WU
      )
  );

  if (isNil(collector)) {
    return;
  }

  state.stage.powerUp = undefined;
  events.push({
    type: 'power-up-taken',
    powerUpType: powerUp.type,
    playerSlot: collector.slot,
    position: {
      x: powerUp.positionX + POWER_UP_SIZE_WU / 2,
      y: powerUp.positionY + POWER_UP_SIZE_WU / 2,
    },
  });
  applyPowerUpEffect(state, powerUp.type, collector, events);
  awardScore(state, POWER_UP_PICKUP_POINTS, events);
}
