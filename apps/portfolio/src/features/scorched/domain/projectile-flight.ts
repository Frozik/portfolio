import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import type { BallisticsEnvironment } from './ballistics';
import { hasCrossedApex, stepProjectile, traceTerrainImpact } from './ballistics';
import {
  COLUMN_CENTER_OFFSET_WU,
  DEFAULT_ROLLER_SPEED_WU_PER_TICK,
  LIQUID_DIRT_MAX_HALF_SPAN_COLUMNS,
  LIQUID_DIRT_POUR_INTERVAL_TICKS,
  LIQUID_DIRT_POUR_PORTIONS,
  MAX_FLIGHT_TICKS,
  ROLLER_MAX_CLIMB_WU_PER_COLUMN,
  ROLLER_MAX_TRAVEL_COLUMNS,
  ROLLER_SHIELD_STANDOFF_WU,
  ROLLER_SPEED_WU_PER_TICK,
  TANK_HALF_WIDTH_WU,
} from './constants';
import type { ShieldAbsorption } from './items/behaviors';
import {
  absorbWithShield,
  applyGuidance,
  applyMagDeflection,
  resolveShieldInteraction,
} from './items/behaviors';
import { getTankCenter, isInsideTankBox } from './tank-geometry';
import type { Heightfield } from './terrain/heightfield';
import {
  fillHollows,
  getColumnIndexAt,
  getDownhillStep,
  getSurfaceHeight,
} from './terrain/heightfield';
import type {
  GuidanceKind,
  MagDeflectorState,
  PhysicsOptions,
  PlayerId,
  PouringState,
  Projectile,
  ProjectileEndReason,
  ProjectileState,
  RollingState,
  TankState,
  WorldEvent,
} from './types';
import { splitAtApex } from './weapons/behaviors';
import { getWeapon } from './weapons/catalog';
import { getBlastPeakDamage } from './weapons/explosions';

/**
 * The slice of the round a shell in the air is allowed to touch. Everything that outlives the
 * flight — the projectile list, the events, the damage ledger — is reached through here rather
 * than owned, so the flight rules stay a pure function of the world they are handed.
 */
export interface ProjectileFlightContext {
  getField(): Heightfield;
  setField(field: Heightfield): void;
  getTanks(): readonly TankState[];
  getPhysics(): PhysicsOptions;
  getMagDeflectors(): readonly MagDeflectorState[];
  setMagDeflectors(deflectors: readonly MagDeflectorState[]): void;
  createEnvironment(guidance: GuidanceKind | undefined): BallisticsEnvironment;
  pushEvent(event: WorldEvent): void;
  getTank(playerId: PlayerId): TankState | undefined;
  spawnWarhead(
    parent: Projectile,
    state: ProjectileState,
    blastRadiusWu: number,
    stageIndex: number
  ): Projectile;
  removeProjectile(projectile: Projectile): void;
  endProjectile(projectile: Projectile, position: Vector2, reason: ProjectileEndReason): void;
  detonate(projectile: Projectile, impact: Vector2, isDirectTankHit: boolean): void;
  applyShieldAbsorption(tank: TankState, absorption: ShieldAbsorption): void;
}

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

function beginRolling(
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
function rollProjectile(
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

function beginPouring(projectile: Projectile, impact: Vector2): void {
  projectile.state = { position: impact, velocity: { x: 0, y: 0 } };
  projectile.pouring = { remainingPortions: LIQUID_DIRT_POUR_PORTIONS, cooldownTicks: 0 };
}

/**
 * Liquid dirt does not appear as one instant plug: the shell sits where it landed and empties
 * itself in portions, each one levelling out through the basin, until the load freezes solid.
 */
function pourLiquidDirt(
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

function steerProjectile(context: ProjectileFlightContext, projectile: Projectile): Vector2 {
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

/**
 * Evaluated against the position the shell started the tick at: the tick that carries it out
 * of its own hull must still ignore the launcher, or the outbound segment clips it.
 */
function updateMuzzleClearance(
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

function resolveTankCollision(
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
