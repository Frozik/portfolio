import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { absorbWithShield, resolveShieldInteraction } from './items/behaviors';
import type { ProjectileFlightContext } from './projectile-flight-context';
import { isInsideTankBox } from './tank-geometry';
import type { Projectile, TankState } from './types';
import { getBlastPeakDamage } from './weapons/explosions';

/**
 * Evaluated against the position the shell started the tick at: the tick that carries it out
 * of its own hull must still ignore the launcher, or the outbound segment clips it.
 */
export function updateMuzzleClearance(
  context: ProjectileFlightContext,
  projectile: Projectile,
  position: Vector2
): void {
  if (projectile.hasClearedOwner) {
    return;
  }

  const owner = context.getTank(projectile.ownerId);

  projectile.hasClearedOwner = owner === undefined || !isInsideTankBox(owner, position);
}

/** True when the shell met a hull this tick and its flight is over — or turned around by a shield. */
export function resolveTankCollision(
  context: ProjectileFlightContext,
  projectile: Projectile,
  previousPosition: Vector2
): boolean {
  const struck = findStruckTank(context, projectile, previousPosition, projectile.state.position);

  if (struck === undefined) {
    return false;
  }

  const interaction = resolveShieldInteraction(
    struck.shield,
    struck.playerId === projectile.ownerId
  );

  switch (interaction) {
    case 'absorb-direct-hit':
      context.applyShieldAbsorption(
        struck,
        absorbWithShield(struck.shield, getBlastPeakDamage(projectile.blastRadiusWu))
      );
      context.endProjectile(projectile, projectile.state.position, 'shield');

      return true;
    case 'deflect':
      projectile.state = {
        position: previousPosition,
        velocity: {
          x: -projectile.state.velocity.x,
          y: Math.abs(projectile.state.velocity.y),
        },
      };
      context.pushEvent({
        type: 'shield-deflected',
        playerId: struck.playerId,
        projectileId: projectile.id,
      });
      // Turning a shell around costs the bubble as much as eating it would have: without this
      // the force tier's capacity was never spent, so it deflected for ever and made the dearer
      // Heavy Shield — which merely absorbs — a worse buy at every price.
      context.applyShieldAbsorption(
        struck,
        absorbWithShield(struck.shield, getBlastPeakDamage(projectile.blastRadiusWu))
      );

      return true;
    case 'none':
    case 'pass-through':
      context.detonate(projectile, projectile.state.position, true);

      return true;
    default:
      return assertNever(interaction);
  }
}

function findStruckTank(
  context: ProjectileFlightContext,
  projectile: Projectile,
  from: Vector2,
  to: Vector2
): TankState | undefined {
  const stepCount = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y)));

  for (let step = 1; step <= stepCount; step++) {
    const progress = step / stepCount;
    const probe: Vector2 = {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
    };
    const struck = context
      .getTanks()
      .find(
        tank =>
          tank.isAlive &&
          (projectile.hasClearedOwner || tank.playerId !== projectile.ownerId) &&
          isInsideTankBox(tank, probe)
      );

    if (struck !== undefined) {
      return struck;
    }
  }

  return undefined;
}
