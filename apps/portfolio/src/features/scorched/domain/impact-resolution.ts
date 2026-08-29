import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { getTankCenter, getTankViews } from './tank-geometry';
import type { Heightfield } from './terrain/heightfield';
import {
  carveWedge,
  computeTankFalls,
  depositCircle,
  depositWedge,
  getSurfaceHeight,
} from './terrain/heightfield';
import type {
  DamageCause,
  PhysicsOptions,
  PlayerId,
  Projectile,
  ProjectileState,
  TankState,
  WorldEvent,
} from './types';
import type { ImpactEffect } from './weapons/behaviors';
import { computeNapalmDamage, resolveImpact } from './weapons/behaviors';
import { getWeapon } from './weapons/catalog';
import { applyBlastToTerrain, computeBlastDamage } from './weapons/explosions';

/**
 * The slice of the round a detonation is allowed to touch. The damage ledger, the projectile list
 * and the settling budget stay with the round: an impact only reports into them.
 */
export interface ImpactResolutionContext {
  getField(): Heightfield;
  setField(field: Heightfield): void;
  getTanks(): readonly TankState[];
  getPhysics(): PhysicsOptions;
  pushEvent(event: WorldEvent): void;
  getTank(playerId: PlayerId): TankState | undefined;
  spawnWarhead(
    parent: Projectile,
    state: ProjectileState,
    blastRadiusWu: number,
    stageIndex: number
  ): Projectile;
  removeProjectile(projectile: Projectile): void;
  extendSettleByDrop(dropWu: number): void;
  applyDamage(
    playerId: PlayerId,
    amount: number,
    sourceId: PlayerId | undefined,
    cause: DamageCause
  ): void;
}

export function detonate(
  context: ImpactResolutionContext,
  projectile: Projectile,
  impact: Vector2,
  isDirectTankHit: boolean
): void {
  context.removeProjectile(projectile);

  const weapon = getWeapon(projectile.weaponId);
  const effects = resolveImpact(weapon, {
    field: context.getField(),
    impact,
    velocity: projectile.state.velocity,
    blastRadiusWu: projectile.blastRadiusWu,
    stageIndex: projectile.stageIndex,
    tanks: getTankViews(context.getTanks()),
  });

  context.pushEvent({
    type: 'projectile-ended',
    projectileId: projectile.id,
    position: impact,
    reason: isDirectTankHit ? 'tank' : 'terrain',
  });

  for (const effect of effects) {
    applyEffect(context, projectile, effect);
  }

  applyTankFalls(context);
}

function applyEffect(
  context: ImpactResolutionContext,
  projectile: Projectile,
  effect: ImpactEffect
): void {
  switch (effect.kind) {
    case 'explosion':
      applyExplosion(context, projectile, effect.center, effect.radiusWu);
      break;
    case 'carve':
      carve(context, effect.center, effect.radiusWu);
      break;
    case 'carve-wedge': {
      const carved = carveWedge(context.getField(), effect.apex, effect.radiusWu);

      noteSettling(context, carved.field, carved.affectedColumns);
      context.setField(carved.field);
      context.pushEvent({
        type: 'terrain-carved',
        shape: 'wedge',
        center: effect.apex,
        radiusWu: effect.radiusWu,
      });
      break;
    }
    case 'deposit':
      context.setField(depositCircle(context.getField(), effect.center, effect.radiusWu).field);
      context.pushEvent({
        type: 'terrain-deposited',
        center: effect.center,
        radiusWu: effect.radiusWu,
      });
      break;
    case 'deposit-wedge':
      context.setField(depositWedge(context.getField(), effect.apex, effect.radiusWu).field);
      context.pushEvent({
        type: 'terrain-deposited',
        center: effect.apex,
        radiusWu: effect.radiusWu,
      });
      break;
    case 'napalm':
      context.pushEvent({ type: 'napalm-pooled', pools: effect.pools });

      for (const damage of computeNapalmDamage(effect.pools, getTankViews(context.getTanks()))) {
        context.applyDamage(damage.playerId, damage.amount, projectile.ownerId, 'napalm');
      }
      break;
    case 'spawn-warheads':
      for (const warhead of effect.warheads) {
        context.spawnWarhead(projectile, warhead.state, warhead.blastRadiusWu, warhead.stageIndex);
      }
      break;
    default:
      assertNever(effect);
  }
}

function carve(context: ImpactResolutionContext, center: Vector2, radiusWu: number): void {
  const carved = applyBlastToTerrain(context.getField(), center, radiusWu);

  noteSettling(context, carved.field, carved.affectedColumns);
  context.setField(carved.field);
  context.pushEvent({ type: 'terrain-carved', shape: 'circle', center, radiusWu });
}

/** Extends the settling wait to cover the deepest drop this carve just caused. */
function noteSettling(
  context: ImpactResolutionContext,
  carvedField: Heightfield,
  affectedColumns: readonly number[]
): void {
  const field = context.getField();

  context.extendSettleByDrop(
    affectedColumns.reduce(
      (deepest, column) =>
        Math.max(deepest, getSurfaceHeight(field, column) - getSurfaceHeight(carvedField, column)),
      0
    )
  );
}

function applyExplosion(
  context: ImpactResolutionContext,
  projectile: Projectile,
  center: Vector2,
  radiusWu: number
): void {
  context.pushEvent({
    type: 'explosion',
    position: center,
    radiusWu,
    weaponId: projectile.weaponId,
  });
  carve(context, center, radiusWu);

  const targets = context
    .getTanks()
    .filter(tank => tank.isAlive)
    .map(tank => ({ playerId: tank.playerId, position: getTankCenter(tank) }));

  for (const damage of computeBlastDamage(center, radiusWu, targets)) {
    context.applyDamage(damage.playerId, damage.amount, projectile.ownerId, 'blast');
  }
}

/** Dirt lost under a tank drops it; the tank rides the settling sand down, gently and free. */
function applyTankFalls(context: ImpactResolutionContext): void {
  if (!context.getPhysics().areTankFallsEnabled) {
    return;
  }

  const falls = computeTankFalls(
    context.getField(),
    context
      .getTanks()
      .filter(tank => tank.isAlive)
      .map(tank => ({
        playerId: tank.playerId,
        columnIndex: tank.columnIndex,
        positionY: tank.positionY,
      }))
  );

  for (const fall of falls) {
    const tank = context.getTank(fall.playerId);

    if (tank === undefined) {
      continue;
    }

    context.extendSettleByDrop(fall.fallDistanceWu);

    context.pushEvent({
      type: 'tank-fell',
      playerId: fall.playerId,
      fromY: fall.fromY,
      toY: fall.toY,
    });
    tank.positionY = fall.toY;
  }
}
