import type { Vector2 } from '@frozik/utils/math/vector2';

import { refineAimForWind } from '../ai/aim-solver';
import { clampAim, getLaunchOrigin, getLaunchVelocity, getMaxPower } from '../ballistics';
import { COLUMN_CENTER_OFFSET_WU, FIELD_HEIGHT_WU, LASER_DAMAGE } from '../constants';
import type { ImpactResolutionContext } from '../impact-resolution';
import { detonate } from '../impact-resolution';
import { isLaserBlockedBy } from '../items/behaviors';
import { isPermanentItem } from '../items/catalog';
import { getTankCenter, getTankViews } from '../tank-geometry';
import type {
  GuidanceKind,
  Projectile,
  ProjectileState,
  TankState,
  WeaponId,
  WorldEvent,
} from '../types';
import { isPerShotWallMode, resolveWallMode } from '../walls';
import { computeLaserHits, getLaserBeamEnd, getPlasmaRadius } from '../weapons/behaviors';
import type { WeaponDefinition } from '../weapons/catalog';
import { getWeapon } from '../weapons/catalog';
import { applyDamage } from './damage';
import { createRoundEnvironment } from './environment';
import type { RoundState } from './round-state';
import { finishTurn, getActiveTank } from './turn-flow';

export interface FireOptions {
  readonly weaponId: WeaponId;
  readonly guidance?: GuidanceKind;
  readonly guidanceTarget?: Vector2;
  readonly useContactTrigger?: boolean;
  readonly plasmaBatteries?: number;
}

/** [MANUAL §6] Dirt Charge is Riot Charge in reverse: it piles a wedge over the firing tank. */
const SELF_CENTERED_FAMILIES: readonly WeaponDefinition['family'][] = [
  'riot-charge',
  'plasma',
  'dirt-charge',
];

const DEFAULT_PLASMA_BATTERIES = 1;
const FIRST_STAGE_INDEX = 0;

interface ShotParams {
  readonly tank: TankState;
  readonly weapon: WeaponDefinition;
  readonly fireOptions: FireOptions;
  readonly shotId: number;
  readonly hasContactTrigger: boolean;
}

function createProjectile(
  state: RoundState,
  shot: ShotParams,
  projectileState: ProjectileState,
  blastRadiusWu: number
): Projectile {
  return {
    id: state.nextProjectileId++,
    ownerId: shot.tank.playerId,
    weaponId: shot.weapon.id,
    shotId: shot.shotId,
    hasContactTrigger: shot.hasContactTrigger,
    guidance: shot.fireOptions.guidance,
    guidanceTarget: shot.fireOptions.guidanceTarget,
    blastRadiusWu,
    stageIndex: FIRST_STAGE_INDEX,
    state: projectileState,
    rolling: undefined,
    pouring: undefined,
    hasPassedApex: false,
    hasClearedOwner: false,
    isMagDeflected: false,
    ticksAlive: 0,
  };
}

/** Sub-warheads inherit the shot's Contact Trigger — one trigger covers the whole shot. */
export function spawnWarhead(
  state: RoundState,
  parent: Projectile,
  projectileState: ProjectileState,
  blastRadiusWu: number,
  stageIndex: number
): Projectile {
  const warhead: Projectile = {
    id: state.nextProjectileId++,
    ownerId: parent.ownerId,
    weaponId: parent.weaponId,
    shotId: parent.shotId,
    hasContactTrigger: parent.hasContactTrigger,
    guidance: undefined,
    guidanceTarget: undefined,
    blastRadiusWu,
    stageIndex,
    state: projectileState,
    rolling: undefined,
    pouring: undefined,
    hasPassedApex: true,
    hasClearedOwner: true,
    isMagDeflected: false,
    ticksAlive: 0,
  };

  state.projectiles.push(warhead);

  return warhead;
}

/** A permanent device corrects every shot it is installed for; anything else is spent per use. */
function consumeGuidance(
  state: RoundState,
  tank: TankState,
  guidance: GuidanceKind | undefined
): GuidanceKind | undefined {
  if (guidance === undefined) {
    return undefined;
  }

  if (isPermanentItem(guidance)) {
    return state.inventories.getItemCount(tank.playerId, guidance) > 0 ? guidance : undefined;
  }

  return state.inventories.consumeItem(tank.playerId, guidance) > 0 ? guidance : undefined;
}

/** [MANUAL §7] Lazy Boy aims the tank by itself — wind-aware — before the trigger drops. */
function applyLazyBoyAim(state: RoundState, tank: TankState, target: Vector2 | undefined): void {
  if (target === undefined) {
    return;
  }

  const solved = refineAimForWind(
    getTankCenter(tank),
    target,
    createRoundEnvironment(state, undefined),
    state.field,
    getMaxPower(tank.health)
  );

  if (solved !== undefined) {
    tank.aim = clampAim(solved, tank.health);
  }
}

function launchProjectile(state: RoundState, shot: ShotParams): void {
  const { tank, weapon } = shot;
  const projectileState: ProjectileState = {
    position: getLaunchOrigin(tank.columnIndex + COLUMN_CENTER_OFFSET_WU, tank.positionY, tank.aim),
    velocity: getLaunchVelocity(tank.aim),
  };
  const projectile = createProjectile(
    state,
    shot,
    projectileState,
    weapon.hopRadiiWu[0] ?? weapon.blastRadiusWu
  );

  state.projectiles.push(projectile);
  state.events.push({
    type: 'projectile-launched',
    projectileId: projectile.id,
    ownerId: tank.playerId,
    weaponId: weapon.id,
    position: projectileState.position,
    velocity: projectileState.velocity,
  });
}

/** [MANUAL §6] Riot charges and plasma go off at the tank rather than flying anywhere. */
function fireSelfCentered(
  state: RoundState,
  context: ImpactResolutionContext,
  shot: ShotParams
): void {
  const { tank, weapon, fireOptions } = shot;
  const batteries =
    weapon.family === 'plasma'
      ? state.inventories.consumeItem(
          tank.playerId,
          'battery',
          fireOptions.plasmaBatteries ?? DEFAULT_PLASMA_BATTERIES
        )
      : 0;
  const blastRadiusWu =
    weapon.family === 'plasma' ? getPlasmaRadius(batteries) : weapon.blastRadiusWu;
  const projectile = createProjectile(
    state,
    shot,
    { position: getTankCenter(tank), velocity: { x: 0, y: -1 } },
    blastRadiusWu
  );

  if (weapon.family === 'plasma') {
    state.events.push({
      type: 'plasma-fired',
      center: getTankCenter(tank),
      radiusWu: blastRadiusWu,
    });
  }

  detonate(context, projectile, getTankCenter(tank), false);
}

/** [MANUAL §6] The beam is instant and passes through dirt and shields alike. */
function fireLaser(state: RoundState, tank: TankState): void {
  const origin = getTankCenter(tank);
  const direction = getLaunchVelocity({ ...tank.aim, power: 1 });
  const targets = getTankViews(state.tanks).filter(view => view.playerId !== tank.playerId);

  state.events.push({
    type: 'laser-fired',
    ownerId: tank.playerId,
    from: origin,
    to: getLaserBeamEnd(origin, direction, state.field.length, FIELD_HEIGHT_WU),
  });

  for (const hit of computeLaserHits(origin, direction, targets)) {
    const target = state.tanks.find(candidate => candidate.playerId === hit.playerId);

    if (target !== undefined && !isLaserBlockedBy(target.shield)) {
      applyDamage(state, hit.playerId, LASER_DAMAGE, tank.playerId, 'laser');
    }
  }
}

/** The active tank pulls the trigger; the events buffer is the caller's to clear beforehand. */
export function fire(
  state: RoundState,
  context: ImpactResolutionContext,
  fireOptions: FireOptions
): readonly WorldEvent[] {
  const tank = getActiveTank(state);

  if (tank === undefined || state.phase !== 'aiming') {
    return state.events;
  }

  const weapon = getWeapon(fireOptions.weaponId);

  if (!state.inventories.consumeAmmo(tank.playerId, weapon)) {
    return state.events;
  }

  if (isPerShotWallMode(state.options.physics.wallMode)) {
    state.wallMode = resolveWallMode(state.options.physics.wallMode);
  }

  const shotId = state.nextShotId++;
  const hasContactTrigger = state.inventories.consumeContactTrigger(
    tank.playerId,
    fireOptions.useContactTrigger
  );

  state.phase = 'flight';

  if (weapon.family === 'laser') {
    fireLaser(state, tank);
    finishTurn(state);

    return state.events;
  }

  const shot: ShotParams = { tank, weapon, fireOptions, shotId, hasContactTrigger };

  if (SELF_CENTERED_FAMILIES.includes(weapon.family)) {
    fireSelfCentered(state, context, shot);
    finishTurn(state);

    return state.events;
  }

  const guidance = consumeGuidance(state, tank, fireOptions.guidance);

  if (guidance === 'lazy-boy') {
    applyLazyBoyAim(state, tank, fireOptions.guidanceTarget);
  }

  launchProjectile(state, {
    ...shot,
    // Lazy Boy has already aimed the tank; the shot itself flies ordinary ballistics.
    fireOptions: { ...fireOptions, guidance: guidance === 'lazy-boy' ? undefined : guidance },
  });

  return state.events;
}
