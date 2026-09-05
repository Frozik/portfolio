import type { Vector2 } from '@frozik/utils/math/vector2';

import type { IBulletTarget } from '../bullets';
import { TANK_SIZE_WU } from '../constants';
import type { IEnemyAiContext } from '../enemy-ai';
import { getBaseCenter } from '../field';
import type { IMovementContext, TankBox } from '../movement';
import { boxesOverlap } from '../movement';
import type { WorldState } from './world-state';

export function getTankCenter(tank: TankBox): Vector2 {
  return { x: tank.positionX + TANK_SIZE_WU / 2, y: tank.positionY + TANK_SIZE_WU / 2 };
}

/** Active players and enemies past their spawn twinkle — the tanks that bullets and movement can meet. */
export function collectCollidableTanks(state: WorldState): readonly TankBox[] {
  return [
    ...state.players.filter(player => player.isActive),
    ...state.stage.enemies.filter(enemy => enemy.twinkleTicksRemaining === 0),
  ];
}

export function collectBulletTargets(state: WorldState): readonly IBulletTarget[] {
  return [
    ...state.players
      .filter(player => player.isActive)
      .map(player => ({
        ref: { side: 'player' as const, slot: player.slot },
        positionX: player.positionX,
        positionY: player.positionY,
      })),
    ...state.stage.enemies
      .filter(enemy => enemy.twinkleTicksRemaining === 0)
      .map(enemy => ({
        ref: { side: 'enemy' as const, slot: enemy.slot },
        positionX: enemy.positionX,
        positionY: enemy.positionY,
      })),
  ];
}

/** Already-overlapping tanks are not blockers — spawn-stacked tanks must be able to drive apart. */
export function createMovementContext(state: WorldState, mover: TankBox): IMovementContext {
  const blockers = collectCollidableTanks(state).filter(
    tank =>
      tank !== mover &&
      !boxesOverlap(mover.positionX, mover.positionY, tank.positionX, tank.positionY, TANK_SIZE_WU)
  );

  return { terrain: state.stage.terrain, blockers };
}

export function createAiContext(state: WorldState): IEnemyAiContext {
  return {
    ticksSinceStageStart: state.stage.ticks,
    spawnIntervalTicks: state.stage.spawnIntervalTicks,
    playerCenters: state.players.map(player =>
      player.isActive ? getTankCenter(player) : undefined
    ),
    baseCenter: getBaseCenter(state.stage.baseCell),
  };
}
