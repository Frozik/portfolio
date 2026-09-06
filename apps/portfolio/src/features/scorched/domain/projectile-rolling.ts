import type { Vector2 } from '@frozik/utils/math/vector2';
import {
  COLUMN_CENTER_OFFSET_WU,
  DEFAULT_ROLLER_SPEED_WU_PER_TICK,
  ROLLER_MAX_CLIMB_WU_PER_COLUMN,
  ROLLER_MAX_TRAVEL_COLUMNS,
  ROLLER_SHIELD_STANDOFF_WU,
  ROLLER_SPEED_WU_PER_TICK,
  TANK_HALF_WIDTH_WU,
} from './constants';
import type { ProjectileFlightContext } from './projectile-flight-context';
import { getTankCenter } from './tank-geometry';
import { getColumnIndexAt, getDownhillStep, getSurfaceHeight } from './terrain/heightfield';
import type { Projectile, RollingState } from './types';

export function beginRolling(
  context: ProjectileFlightContext,
  projectile: Projectile,
  impact: Vector2
): void {
  const field = context.getField();
  const columnIndex = getColumnIndexAt(field, impact.x);
  const direction = Math.sign(projectile.state.velocity.x) || getDownhillStep(field, columnIndex);

  projectile.state = {
    position: { x: columnIndex + COLUMN_CENTER_OFFSET_WU, y: getSurfaceHeight(field, columnIndex) },
    velocity: { x: 0, y: 0 },
  };

  if (direction === 0) {
    context.detonate(projectile, projectile.state.position, false);

    return;
  }

  projectile.rolling = { direction, travelledColumns: 0, progressWu: 0 };
  context.pushEvent({ type: 'roller-landed', position: { ...projectile.state.position } });
}

/**
 * The roller crawls the surface in its flight direction — over hills too — and detonates on
 * the first tank it touches, or at arm's length from one hiding under a shield. A wall too
 * steep to climb, the field's edge or the travel cap all set it off where it stands.
 */
export function rollProjectile(
  context: ProjectileFlightContext,
  projectile: Projectile,
  rolling: RollingState
): void {
  const speed = ROLLER_SPEED_WU_PER_TICK[projectile.weaponId] ?? DEFAULT_ROLLER_SPEED_WU_PER_TICK;

  rolling.progressWu += speed;

  while (rolling.progressWu >= 1) {
    rolling.progressWu -= 1;

    const field = context.getField();
    const columnIndex = getColumnIndexAt(field, projectile.state.position.x);
    const nextColumn = getColumnIndexAt(field, columnIndex + rolling.direction);
    const climbWu = getSurfaceHeight(field, nextColumn) - getSurfaceHeight(field, columnIndex);
    const isStuck =
      nextColumn === columnIndex ||
      climbWu > ROLLER_MAX_CLIMB_WU_PER_COLUMN ||
      rolling.travelledColumns >= ROLLER_MAX_TRAVEL_COLUMNS;

    if (isStuck) {
      context.detonate(projectile, projectile.state.position, false);

      return;
    }

    rolling.travelledColumns++;
    projectile.state = {
      position: { x: nextColumn + COLUMN_CENTER_OFFSET_WU, y: getSurfaceHeight(field, nextColumn) },
      velocity: { x: rolling.direction * speed, y: 0 },
    };

    if (detonateRollerOnContact(context, projectile)) {
      return;
    }
  }
}

/** True when the roll just reached a tank: on the hull it is a direct hit, a shield holds it off. */
function detonateRollerOnContact(
  context: ProjectileFlightContext,
  projectile: Projectile
): boolean {
  const rollX = projectile.state.position.x;

  for (const tank of context.getTanks()) {
    if (!tank.isAlive) {
      continue;
    }

    const gapWu = Math.abs(rollX - (tank.columnIndex + COLUMN_CENTER_OFFSET_WU));

    if (tank.shield !== undefined && gapWu <= TANK_HALF_WIDTH_WU + ROLLER_SHIELD_STANDOFF_WU) {
      context.detonate(projectile, projectile.state.position, false);

      return true;
    }

    if (tank.shield === undefined && gapWu <= TANK_HALF_WIDTH_WU) {
      context.detonate(projectile, getTankCenter(tank), true);

      return true;
    }
  }

  return false;
}
