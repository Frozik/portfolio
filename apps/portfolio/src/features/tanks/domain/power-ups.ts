import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { random } from 'lodash-es';
import {
  CLOCK_FREEZE_DURATION_TICKS,
  HELMET_DURATION_TICKS,
  MAX_STAR_LEVEL,
  POWER_UP_POSITION_ROLL_ATTEMPTS,
  POWER_UP_TYPE_TABLE,
  SHOVEL_FLASH_TOGGLE_TICKS,
  SHOVEL_FLASHING_TICKS,
  SHOVEL_TOTAL_TICKS,
} from './constants';
import type { PowerUpGrid } from './field';

import type { PowerUpType } from './types';

export type PowerUpEffect =
  | { readonly kind: 'shield'; readonly ticks: number }
  | { readonly kind: 'freeze-enemies'; readonly ticks: number }
  | { readonly kind: 'fortify-base'; readonly ticks: number }
  | { readonly kind: 'upgrade' }
  | { readonly kind: 'destroy-all-enemies' }
  | { readonly kind: 'extra-life' };

export type BaseWallMaterial = 'brick' | 'steel';

/** Star and grenade appear twice in the table, which is what doubles their odds. */
export function rollPowerUpType(): PowerUpType {
  return POWER_UP_TYPE_TABLE[random(POWER_UP_TYPE_TABLE.length - 1)];
}

function rollGridPosition(grid: PowerUpGrid): Vector2 {
  return {
    x: grid.columnsWu[random(grid.columnsWu.length - 1)],
    y: grid.rowsWu[random(grid.rowsWu.length - 1)],
  };
}

/** Both coordinates are re-rolled together while the spot overlaps a tank. */
export function rollPowerUpPosition(
  grid: PowerUpGrid,
  isBlocked: (position: Vector2) => boolean
): Vector2 {
  let position = rollGridPosition(grid);

  for (
    let attempt = 1;
    attempt < POWER_UP_POSITION_ROLL_ATTEMPTS && isBlocked(position);
    attempt++
  ) {
    position = rollGridPosition(grid);
  }

  return position;
}

export function getPowerUpEffect(powerUpType: PowerUpType): PowerUpEffect {
  switch (powerUpType) {
    case 'helmet':
      return { kind: 'shield', ticks: HELMET_DURATION_TICKS };
    case 'clock':
      return { kind: 'freeze-enemies', ticks: CLOCK_FREEZE_DURATION_TICKS };
    case 'shovel':
      return { kind: 'fortify-base', ticks: SHOVEL_TOTAL_TICKS };
    case 'star':
      return { kind: 'upgrade' };
    case 'grenade':
      return { kind: 'destroy-all-enemies' };
    case 'tank':
      return { kind: 'extra-life' };
    default:
      return assertNever(powerUpType);
  }
}

export function upgradeStarLevel(starLevel: number): number {
  return Math.min(starLevel + 1, MAX_STAR_LEVEL);
}

/** The warning phase toggles every 16 ticks and ends on brick, so the revert is seamless. */
export function getBaseWallMaterial(shovelTicksRemaining: number): BaseWallMaterial {
  if (shovelTicksRemaining <= 0) {
    return 'brick';
  }

  if (shovelTicksRemaining > SHOVEL_FLASHING_TICKS) {
    return 'steel';
  }

  return Math.floor(shovelTicksRemaining / SHOVEL_FLASH_TOGGLE_TICKS) % 2 === 0 ? 'brick' : 'steel';
}
