import type { Vector2 } from '@frozik/utils/math/vector2';
import { applyGuidance, applyMagDeflection } from './items/behaviors';
import type { ProjectileFlightContext } from './projectile-flight-context';
import { getTankCenter } from './tank-geometry';
import type { MagDeflectorState, PlayerId, Projectile } from './types';

/** [MANUAL §7] Heat guidance chases whichever tank is nearest to the shell right now. */
function getNearestOpponentCenter(
  context: ProjectileFlightContext,
  ownerId: PlayerId,
  position: Vector2
): Vector2 | undefined {
  let nearest: Vector2 | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const tank of context.getTanks()) {
    if (!tank.isAlive || tank.playerId === ownerId) {
      continue;
    }

    const center = getTankCenter(tank);
    const distance = Math.hypot(center.x - position.x, center.y - position.y);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = center;
    }
  }

  return nearest;
}

/** The velocity the shell flies with this tick, after its own guidance and every hostile deflector had their say. */
export function steerProjectile(context: ProjectileFlightContext, projectile: Projectile): Vector2 {
  const target =
    projectile.guidance === 'heat-guidance'
      ? (getNearestOpponentCenter(context, projectile.ownerId, projectile.state.position) ??
        projectile.guidanceTarget)
      : projectile.guidanceTarget;
  const guided =
    projectile.guidance === undefined
      ? projectile.state.velocity
      : applyGuidance(
          projectile.guidance,
          projectile.state.position,
          projectile.state.velocity,
          target,
          // A flat shot never crosses an apex, so a sinking velocity counts as descending too.
          projectile.hasPassedApex || projectile.state.velocity.y <= 0
        );
  const deflectors = context.getMagDeflectors();
  const foreignDeflectors = deflectors.filter(
    deflector => deflector.ownerId !== projectile.ownerId
  );
  const deflection = applyMagDeflection(projectile.state.position, guided, foreignDeflectors);

  context.setMagDeflectors(
    deflectors.map(
      deflector =>
        deflection.deflectors.find(updated => updated.ownerId === deflector.ownerId) ?? deflector
    )
  );
  reportMagDeflection(context, projectile, foreignDeflectors, deflection.deflectors);

  return deflection.velocity;
}

/** Only the tick a deflector takes hold is announced; the push itself lasts the whole pass. */
function reportMagDeflection(
  context: ProjectileFlightContext,
  projectile: Projectile,
  before: readonly MagDeflectorState[],
  after: readonly MagDeflectorState[]
): void {
  const grabbing = after.find(deflector => {
    const previous = before.find(candidate => candidate.ownerId === deflector.ownerId);

    return previous !== undefined && deflector.remainingCapacity < previous.remainingCapacity;
  });

  if (grabbing !== undefined && !projectile.isMagDeflected) {
    context.pushEvent({
      type: 'mag-deflected',
      playerId: grabbing.ownerId,
      projectileId: projectile.id,
    });
  }

  projectile.isMagDeflected = grabbing !== undefined;
}
