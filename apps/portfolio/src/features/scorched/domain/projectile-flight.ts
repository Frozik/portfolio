import { hasCrossedApex, stepProjectile, traceTerrainImpact } from './ballistics';
import { MAX_FLIGHT_TICKS } from './constants';
import type { ProjectileFlightContext } from './projectile-flight-context';
import { steerProjectile } from './projectile-guidance';
import { beginPouring, pourLiquidDirt } from './projectile-pouring';
import { beginRolling, rollProjectile } from './projectile-rolling';
import { resolveTankCollision, updateMuzzleClearance } from './projectile-tank-collision';
import type { Projectile } from './types';
import { splitAtApex } from './weapons/behaviors';
import { getWeapon } from './weapons/catalog';

export function advanceProjectile(context: ProjectileFlightContext, projectile: Projectile): void {
  const environment = context.createEnvironment(projectile.guidance);
  const previousPosition = projectile.state.position;
  const previousVelocityY = projectile.state.velocity.y;

  projectile.ticksAlive++;

  if (projectile.rolling !== undefined) {
    rollProjectile(context, projectile, projectile.rolling);

    return;
  }

  if (projectile.pouring !== undefined) {
    pourLiquidDirt(context, projectile, projectile.pouring);

    return;
  }

  if (projectile.ticksAlive > MAX_FLIGHT_TICKS) {
    context.endProjectile(projectile, previousPosition, 'expired');

    return;
  }

  updateMuzzleClearance(context, projectile, previousPosition);

  const steered = steerProjectile(context, projectile);
  const stepResult = stepProjectile({ ...projectile.state, velocity: steered }, environment);

  projectile.state = stepResult.state;

  if (stepResult.bounceSide !== undefined) {
    context.pushEvent({
      type: 'projectile-bounced',
      projectileId: projectile.id,
      side: stepResult.bounceSide,
    });
  }

  if (stepResult.outcome === 'absorbed') {
    context.endProjectile(projectile, projectile.state.position, 'absorbed');

    return;
  }

  if (splitMirvAtApex(context, projectile, previousVelocityY)) {
    return;
  }

  if (resolveTankCollision(context, projectile, previousPosition)) {
    return;
  }

  const impact = traceTerrainImpact(
    context.getField(),
    previousPosition,
    projectile.state.position,
    {
      isTunnelingEnabled: context.getPhysics().isTunnelingEnabled,
      hasContactTrigger: projectile.hasContactTrigger,
    }
  );

  if (impact !== undefined) {
    // A roller does not go off where it lands: it settles onto the surface and starts crawling.
    if (getWeapon(projectile.weaponId).family === 'roller' && !projectile.hasContactTrigger) {
      beginRolling(context, projectile, impact);

      return;
    }

    if (getWeapon(projectile.weaponId).family === 'liquid-dirt') {
      beginPouring(projectile, impact);

      return;
    }

    context.detonate(projectile, impact, false);

    return;
  }

  // Checked after the terrain trace: a shell crossing the floor inside the field must land its
  // bedrock detonation rather than vanish out of bounds.
  if (stepResult.outcome === 'lost') {
    context.endProjectile(projectile, projectile.state.position, 'out-of-bounds');
  }
}

function splitMirvAtApex(
  context: ProjectileFlightContext,
  projectile: Projectile,
  previousVelocityY: number
): boolean {
  if (projectile.hasPassedApex || !hasCrossedApex(previousVelocityY, projectile.state.velocity.y)) {
    return false;
  }

  projectile.hasPassedApex = true;

  const weapon = getWeapon(projectile.weaponId);
  const warheads = splitAtApex(weapon, projectile.state);

  if (warheads === undefined) {
    return false;
  }

  context.removeProjectile(projectile);

  for (const warhead of warheads) {
    const spawned = context.spawnWarhead(
      projectile,
      warhead.state,
      warhead.blastRadiusWu,
      warhead.stageIndex
    );

    context.pushEvent({
      type: 'projectile-launched',
      projectileId: spawned.id,
      ownerId: spawned.ownerId,
      weaponId: spawned.weaponId,
      position: spawned.state.position,
      velocity: spawned.state.velocity,
    });
  }

  return true;
}
