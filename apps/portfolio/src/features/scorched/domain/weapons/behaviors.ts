import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp, random } from 'lodash-es';

import {
  COLUMN_CENTER_OFFSET_WU,
  FUNKY_BOMB_BURST_RADIUS_WU,
  FUNKY_BOMB_MAX_BURSTS,
  FUNKY_BOMB_MIN_BURSTS,
  FUNKY_BOMB_SCATTER_HALF_SPAN_WU,
  LASER_BEAM_HALF_WIDTH_WU,
  LEAPFROG_HOP_COUNT,
  LEAPFROG_HOP_ENERGY_DAMPING,
  MIRV_WARHEAD_SPREAD_WU_PER_TICK,
  NAPALM_DAMAGE_PER_DEPTH_WU,
  NAPALM_MAX_CLIMB_WU_PER_COLUMN,
  NAPALM_MAX_POOL_HALF_SPAN_COLUMNS,
  NAPALM_SURFACE_DEPTH_WU,
  PLASMA_MAX_BATTERIES,
  PLASMA_MAX_RADIUS_WU,
  PLASMA_MIN_BATTERIES,
  PLASMA_MIN_RADIUS_WU,
  TANK_CENTER_OFFSET_WU,
} from '../constants';
import type { Heightfield } from '../terrain/heightfield';
import { getColumnCount, getColumnIndexAt, getSurfaceHeight } from '../terrain/heightfield';
import type { NapalmPool, PlayerId, ProjectileState, WeaponFamily } from '../types';
import type { WeaponDefinition } from './catalog';

export interface WarheadSpawn {
  readonly state: ProjectileState;
  readonly blastRadiusWu: number;
  readonly stageIndex: number;
}

/** What an impact does to the world; the round engine is the only thing allowed to apply them. */
export type ImpactEffect =
  | { readonly kind: 'explosion'; readonly center: Vector2; readonly radiusWu: number }
  | { readonly kind: 'carve'; readonly center: Vector2; readonly radiusWu: number }
  | { readonly kind: 'carve-wedge'; readonly apex: Vector2; readonly radiusWu: number }
  | { readonly kind: 'deposit'; readonly center: Vector2; readonly radiusWu: number }
  | { readonly kind: 'deposit-wedge'; readonly apex: Vector2; readonly radiusWu: number }
  | { readonly kind: 'napalm'; readonly pools: readonly NapalmPool[] }
  | { readonly kind: 'spawn-warheads'; readonly warheads: readonly WarheadSpawn[] };

export interface TankColumnView {
  readonly playerId: PlayerId;
  readonly columnIndex: number;
  readonly positionY: number;
  readonly hasShield: boolean;
}

export interface ImpactContext {
  readonly field: Heightfield;
  readonly impact: Vector2;
  readonly velocity: Vector2;
  /** Radius of this specific warhead — plasma and leapfrog hops resolve it per shot. */
  readonly blastRadiusWu: number;
  readonly stageIndex: number;
  readonly tanks: readonly TankColumnView[];
}

export interface LaserHit {
  readonly playerId: PlayerId;
  readonly distanceWu: number;
}

function normalize(vector: Vector2): Vector2 {
  const length = Math.hypot(vector.x, vector.y);

  return length === 0 ? { x: 1, y: 0 } : { x: vector.x / length, y: vector.y / length };
}

/** [MANUAL §6] Plasma is fired from the tank itself and grows with the batteries it burns. */
export function getPlasmaRadius(batteryCount: number): number {
  const batteries = clamp(batteryCount, PLASMA_MIN_BATTERIES, PLASMA_MAX_BATTERIES);
  const progress =
    (batteries - PLASMA_MIN_BATTERIES) / (PLASMA_MAX_BATTERIES - PLASMA_MIN_BATTERIES);

  return PLASMA_MIN_RADIUS_WU + (PLASMA_MAX_RADIUS_WU - PLASMA_MIN_RADIUS_WU) * progress;
}

/**
 * [MANUAL §6] A MIRV splits at the top of its arc into evenly fanned warheads. A shell that
 * hits something before reaching apex never splits at all — that miss is part of the weapon.
 */
export function splitAtApex(
  weapon: WeaponDefinition,
  state: ProjectileState
): readonly WarheadSpawn[] | undefined {
  if (weapon.family !== 'mirv') {
    return undefined;
  }

  const middleIndex = (weapon.warheadCount - 1) / 2;

  return Array.from({ length: weapon.warheadCount }, (_unused, warheadIndex) => ({
    state: {
      position: state.position,
      velocity: {
        x: state.velocity.x + (warheadIndex - middleIndex) * MIRV_WARHEAD_SPREAD_WU_PER_TICK,
        y: state.velocity.y,
      },
    },
    blastRadiusWu: weapon.blastRadiusWu,
    stageIndex: 1,
  }));
}

/**
 * Our default hop geometry: the shell skips forward off the impact, keeping its horizontal
 * run and flipping the vertical component, both damped.
 */
function createLeapfrogHop(context: ImpactContext, radiusWu: number): WarheadSpawn {
  return {
    state: {
      position: context.impact,
      velocity: {
        x: context.velocity.x * LEAPFROG_HOP_ENERGY_DAMPING,
        y: Math.abs(context.velocity.y) * LEAPFROG_HOP_ENERGY_DAMPING,
      },
    },
    blastRadiusWu: radiusWu,
    stageIndex: context.stageIndex + 1,
  };
}

/** Our default: 6–10 secondary bursts land on the ground around the impact point. */
function scatterFunkyBursts(context: ImpactContext, scatterRadiusWu: number): ImpactEffect[] {
  const burstCount = random(FUNKY_BOMB_MIN_BURSTS, FUNKY_BOMB_MAX_BURSTS);

  return Array.from({ length: burstCount }, () => {
    const offsetX = random(-scatterRadiusWu, scatterRadiusWu, true);
    const columnIndex = getColumnIndexAt(context.field, context.impact.x + offsetX);

    return {
      kind: 'explosion' as const,
      center: {
        x: columnIndex + COLUMN_CENTER_OFFSET_WU,
        y: getSurfaceHeight(context.field, columnIndex),
      },
      radiusWu: FUNKY_BOMB_BURST_RADIUS_WU,
    };
  });
}

/**
 * Napalm spreads out from the impact along the surface itself: both fronts advance at
 * once, the liquid feeds whichever front sits lower and climbs only when it must, and a wall too
 * steep to climb stops that side for good. The covered run hugs the terrain profile.
 */
export function computeNapalmPools(
  field: Heightfield,
  impactColumn: number,
  volumeWu: number
): readonly NapalmPool[] {
  const lastIndex = getColumnCount(field) - 1;
  const targetColumns = Math.min(
    1 + 2 * NAPALM_MAX_POOL_HALF_SPAN_COLUMNS,
    Math.max(1, Math.round(volumeWu / NAPALM_SURFACE_DEPTH_WU))
  );
  let firstColumn = impactColumn;
  let lastColumn = impactColumn;

  while (lastColumn - firstColumn + 1 < targetColumns) {
    const leftClimbWu =
      getSurfaceHeight(field, firstColumn - 1) - getSurfaceHeight(field, firstColumn);
    const rightClimbWu =
      getSurfaceHeight(field, lastColumn + 1) - getSurfaceHeight(field, lastColumn);
    const canGoLeft = firstColumn > 0 && leftClimbWu <= NAPALM_MAX_CLIMB_WU_PER_COLUMN;
    const canGoRight = lastColumn < lastIndex && rightClimbWu <= NAPALM_MAX_CLIMB_WU_PER_COLUMN;

    if (!canGoLeft && !canGoRight) {
      break;
    }

    const leftHeight = getSurfaceHeight(field, firstColumn - 1);
    const rightHeight = getSurfaceHeight(field, lastColumn + 1);
    const isLeftShorter = impactColumn - firstColumn <= lastColumn - impactColumn;
    const goLeft =
      canGoLeft &&
      (!canGoRight || leftHeight < rightHeight || (leftHeight === rightHeight && isLeftShorter));

    if (goLeft) {
      firstColumn--;
    } else {
      lastColumn++;
    }
  }

  const surfaceHeights = Array.from({ length: lastColumn - firstColumn + 1 }, (_unused, offset) =>
    getSurfaceHeight(field, firstColumn + offset)
  );

  return [{ firstColumn, surfaceHeights }];
}

/** Standing in fire burns for the coating's depth — the fire is a blanket, not a lake. */
export function computeNapalmDamage(
  pools: readonly NapalmPool[],
  tanks: readonly TankColumnView[]
): readonly { readonly playerId: PlayerId; readonly amount: number }[] {
  const damages: { playerId: PlayerId; amount: number }[] = [];

  for (const tank of tanks) {
    const isBurning = pools.some(
      pool =>
        tank.columnIndex >= pool.firstColumn &&
        tank.columnIndex < pool.firstColumn + pool.surfaceHeights.length
    );

    if (isBurning) {
      damages.push({
        playerId: tank.playerId,
        amount: NAPALM_SURFACE_DEPTH_WU * NAPALM_DAMAGE_PER_DEPTH_WU,
      });
    }
  }

  return damages;
}

/** [MANUAL §6] The beam is a straight line that ignores dirt and shields alike. */
export function computeLaserHits(
  origin: Vector2,
  direction: Vector2,
  tanks: readonly TankColumnView[]
): readonly LaserHit[] {
  const beam = normalize(direction);
  const hits: LaserHit[] = [];

  for (const tank of tanks) {
    const offsetX = tank.columnIndex + COLUMN_CENTER_OFFSET_WU - origin.x;
    const offsetY = tank.positionY + TANK_CENTER_OFFSET_WU - origin.y;
    const alongBeam = offsetX * beam.x + offsetY * beam.y;

    if (alongBeam <= 0) {
      continue;
    }

    const perpendicular = Math.abs(offsetX * beam.y - offsetY * beam.x);

    if (perpendicular <= LASER_BEAM_HALF_WIDTH_WU) {
      hits.push({ playerId: tank.playerId, distanceWu: alongBeam });
    }
  }

  return hits.sort((first, second) => first.distanceWu - second.distanceWu);
}

function getAxisExitDistance(origin: number, direction: number, limitWu: number): number {
  if (direction > 0) {
    return (limitWu - origin) / direction;
  }

  if (direction < 0) {
    return -origin / direction;
  }

  return Number.POSITIVE_INFINITY;
}

/**
 * Where a laser leaves the field. The beam passes through dirt and shields alike, so nothing
 * inside the field can cut it short — only the boundary bounds the segment that gets drawn.
 */
export function getLaserBeamEnd(
  origin: Vector2,
  direction: Vector2,
  fieldWidthWu: number,
  fieldHeightWu: number
): Vector2 {
  const beam = normalize(direction);
  const exitDistanceWu = Math.max(
    0,
    Math.min(
      getAxisExitDistance(origin.x, beam.x, fieldWidthWu),
      getAxisExitDistance(origin.y, beam.y, fieldHeightWu)
    )
  );

  return { x: origin.x + beam.x * exitDistanceWu, y: origin.y + beam.y * exitDistanceWu };
}

function resolveLeapfrogImpact(weapon: WeaponDefinition, context: ImpactContext): ImpactEffect[] {
  const hopRadius = weapon.hopRadiiWu[context.stageIndex] ?? weapon.blastRadiusWu;
  const effects: ImpactEffect[] = [
    { kind: 'explosion', center: context.impact, radiusWu: hopRadius },
  ];

  if (context.stageIndex + 1 >= LEAPFROG_HOP_COUNT) {
    return effects;
  }

  const nextRadius = weapon.hopRadiiWu[context.stageIndex + 1] ?? hopRadius;

  effects.push({ kind: 'spawn-warheads', warheads: [createLeapfrogHop(context, nextRadius)] });

  return effects;
}

function resolveFamilyImpact(
  family: WeaponFamily,
  weapon: WeaponDefinition,
  context: ImpactContext
): readonly ImpactEffect[] {
  switch (family) {
    case 'ballistic':
    case 'mirv':
    case 'plasma':
      return [{ kind: 'explosion', center: context.impact, radiusWu: context.blastRadiusWu }];
    case 'leapfrog':
      return resolveLeapfrogImpact(weapon, context);
    case 'funky':
      return [
        { kind: 'explosion', center: context.impact, radiusWu: FUNKY_BOMB_BURST_RADIUS_WU },
        ...scatterFunkyBursts(context, FUNKY_BOMB_SCATTER_HALF_SPAN_WU),
      ];
    case 'napalm':
      return [
        {
          kind: 'napalm',
          pools: computeNapalmPools(
            context.field,
            getColumnIndexAt(context.field, context.impact.x),
            weapon.flowVolumeWu
          ),
        },
      ];
    // The rolling itself happens in the round; by detonation time the shell is already at rest.
    case 'roller':
      return [{ kind: 'explosion', center: context.impact, radiusWu: context.blastRadiusWu }];
    case 'riot-charge':
      return [{ kind: 'carve-wedge', apex: context.impact, radiusWu: weapon.blastRadiusWu }];
    case 'riot-bomb':
      return [{ kind: 'carve', center: context.impact, radiusWu: weapon.blastRadiusWu }];
    case 'dirt-deposit':
      return [{ kind: 'deposit', center: context.impact, radiusWu: weapon.blastRadiusWu }];
    case 'liquid-dirt':
      // The pouring itself happens in the round, portion by portion; landing changes nothing.
      return [];
    case 'dirt-charge':
      return [{ kind: 'deposit-wedge', apex: context.impact, radiusWu: weapon.blastRadiusWu }];
    case 'laser':
      return [];
    default:
      return assertNever(family);
  }
}

export function resolveImpact(
  weapon: WeaponDefinition,
  context: ImpactContext
): readonly ImpactEffect[] {
  return resolveFamilyImpact(weapon.family, weapon, context);
}
