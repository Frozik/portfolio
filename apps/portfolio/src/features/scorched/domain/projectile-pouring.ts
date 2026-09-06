import type { Vector2 } from '@frozik/utils/math/vector2';
import {
  LIQUID_DIRT_MAX_HALF_SPAN_COLUMNS,
  LIQUID_DIRT_POUR_INTERVAL_TICKS,
  LIQUID_DIRT_POUR_PORTIONS,
} from './constants';
import type { ProjectileFlightContext } from './projectile-flight-context';
import { fillHollows, getColumnIndexAt } from './terrain/heightfield';
import type { PouringState, Projectile } from './types';
import { getWeapon } from './weapons/catalog';

export function beginPouring(projectile: Projectile, impact: Vector2): void {
  projectile.state = { position: impact, velocity: { x: 0, y: 0 } };
  projectile.pouring = { remainingPortions: LIQUID_DIRT_POUR_PORTIONS, cooldownTicks: 0 };
}

/**
 * Liquid dirt does not appear as one instant plug: the shell sits where it landed and empties
 * itself in portions, each one levelling out through the basin, until the load freezes solid.
 */
export function pourLiquidDirt(
  context: ProjectileFlightContext,
  projectile: Projectile,
  pouring: PouringState
): void {
  if (pouring.cooldownTicks > 0) {
    pouring.cooldownTicks--;

    return;
  }

  const field = context.getField();
  const portionWu = getWeapon(projectile.weaponId).flowVolumeWu / LIQUID_DIRT_POUR_PORTIONS;
  const filled = fillHollows(
    field,
    getColumnIndexAt(field, projectile.state.position.x),
    portionWu,
    LIQUID_DIRT_MAX_HALF_SPAN_COLUMNS
  );

  context.setField(filled.field);
  context.pushEvent({
    type: 'dirt-poured',
    position: projectile.state.position,
    columns: filled.affectedColumns,
  });

  pouring.remainingPortions--;
  pouring.cooldownTicks = LIQUID_DIRT_POUR_INTERVAL_TICKS;

  if (pouring.remainingPortions <= 0) {
    context.pushEvent({ type: 'dirt-settled', columns: filled.affectedColumns });
    context.detonate(projectile, projectile.state.position, false);
  }
}
