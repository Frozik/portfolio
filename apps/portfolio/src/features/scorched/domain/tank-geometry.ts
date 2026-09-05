import type { Vector2 } from '@frozik/utils/math/vector2';
import {
  COLUMN_CENTER_OFFSET_WU,
  TANK_CENTER_OFFSET_WU,
  TANK_HALF_WIDTH_WU,
  TANK_HEIGHT_WU,
} from './constants';
import type { TankState } from './types';
import type { TankColumnView } from './weapons/behaviors';

export function getTankCenter(tank: TankState): Vector2 {
  return {
    x: tank.columnIndex + COLUMN_CENTER_OFFSET_WU,
    y: tank.positionY + TANK_CENTER_OFFSET_WU,
  };
}

export function isInsideTankBox(tank: TankState, point: Vector2): boolean {
  return (
    Math.abs(point.x - (tank.columnIndex + COLUMN_CENTER_OFFSET_WU)) <= TANK_HALF_WIDTH_WU &&
    point.y >= tank.positionY &&
    point.y <= tank.positionY + TANK_HEIGHT_WU
  );
}

/** What the weapon behaviours are allowed to see of a tank: where it sits and whether it is covered. */
export function getTankViews(tanks: readonly TankState[]): readonly TankColumnView[] {
  return tanks
    .filter(tank => tank.isAlive)
    .map(tank => ({
      playerId: tank.playerId,
      columnIndex: tank.columnIndex,
      positionY: tank.positionY,
      hasShield: tank.shield !== undefined,
    }));
}
