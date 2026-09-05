import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp, random } from 'lodash-es';

import {
  BORDERS_EXTEND_MARGIN_WU,
  FIELD_HEIGHT_WU,
  FIELD_WIDTH_WU,
  GRAVITY_UNIT_TO_WU_PER_TICK_SQUARED,
  GUN_BARREL_LENGTH_WU,
  GUN_MOUNT_OFFSET_WU,
  GUN_PIVOT_ABOVE_BASE_WU,
  MAX_ELEVATION_DEGREES,
  MAX_FLIGHT_TICKS,
  MIN_ELEVATION_DEGREES,
  MIN_POWER,
  PADDED_WALL_RESTITUTION,
  POWER_PER_HEALTH_POINT,
  POWER_TO_SPEED_WU_PER_TICK,
  PROJECTILE_TUNNEL_DEPTH_WU,
  RESOLVABLE_WALL_MODES,
  RUBBER_WALL_RESTITUTION,
  SPRING_WALL_RESTITUTION,
  VISCOSITY_DAMPING_PER_UNIT,
  WIND_UNIT_TO_WU_PER_TICK_SQUARED,
} from './constants';
import type { Heightfield } from './terrain/heightfield';
import { isSolidAt } from './terrain/heightfield';
import type {
  AimState,
  PhysicsOptions,
  ProjectileState,
  ResolvedWallMode,
  WallMode,
  WallSide,
} from './types';

export interface BallisticsEnvironment {
  readonly gravityWuPerTickSquared: number;
  readonly windAccelerationWuPerTickSquared: number;
  readonly viscosity: number;
  readonly wallMode: ResolvedWallMode;
  readonly isBordersExtendEnabled: boolean;
  readonly fieldWidthWu: number;
  readonly fieldHeightWu: number;
}

type FlightOutcome = 'flying' | 'absorbed' | 'lost';

export interface ProjectileStepResult {
  readonly state: ProjectileState;
  readonly outcome: FlightOutcome;
  readonly bounceSide: WallSide | undefined;
}

type TrajectoryOutcome = 'impact' | 'absorbed' | 'lost' | 'expired';

export interface TrajectoryResult {
  readonly path: readonly Vector2[];
  readonly impact: Vector2 | undefined;
  readonly outcome: TrajectoryOutcome;
  readonly tickCount: number;
}

export interface ImpactTraceOptions {
  readonly isTunnelingEnabled: boolean;
  readonly hasContactTrigger: boolean;
}

const DEGREES_TO_RADIANS = Math.PI / 180;
/** Terrain probe spacing along a tick's flight segment; one wu is one terrain column. */
const IMPACT_TRACE_STEP_WU = 1;

function getGravityAcceleration(gravity: number): number {
  return gravity * GRAVITY_UNIT_TO_WU_PER_TICK_SQUARED;
}

function getWindAcceleration(windUnits: number): number {
  return windUnits * WIND_UNIT_TO_WU_PER_TICK_SQUARED;
}

/** [MANUAL §5] RANDOM re-rolls once per round, ERRATIC once per shot; both use this draw. */
export function resolveWallMode(wallMode: WallMode): ResolvedWallMode {
  switch (wallMode) {
    case 'random':
    case 'erratic':
      return RESOLVABLE_WALL_MODES[random(RESOLVABLE_WALL_MODES.length - 1)];
    default:
      return wallMode;
  }
}

export function isPerShotWallMode(wallMode: WallMode): boolean {
  return wallMode === 'erratic';
}

/** [MANUAL §5] One global wind vector per round, drawn within the configured magnitude. */
export function rollWind(maxWind: number): number {
  return random(-maxWind, maxWind);
}

export function createEnvironment(
  physics: PhysicsOptions,
  windUnits: number,
  wallMode: ResolvedWallMode,
  fieldWidthWu: number = FIELD_WIDTH_WU,
  fieldHeightWu: number = FIELD_HEIGHT_WU
): BallisticsEnvironment {
  return {
    gravityWuPerTickSquared: getGravityAcceleration(physics.gravity),
    windAccelerationWuPerTickSquared: getWindAcceleration(windUnits),
    viscosity: physics.viscosity,
    wallMode,
    isBordersExtendEnabled: physics.isBordersExtendEnabled,
    fieldWidthWu,
    fieldHeightWu,
  };
}

/** [MANUAL §5] Damage caps firepower: a tank at 40 health can never fire harder than 400. */
export function getMaxPower(health: number): number {
  return Math.max(MIN_POWER, health * POWER_PER_HEALTH_POINT);
}

export function clampAim(aim: AimState, health: number): AimState {
  return {
    facing: aim.facing,
    elevationDegrees: clamp(aim.elevationDegrees, MIN_ELEVATION_DEGREES, MAX_ELEVATION_DEGREES),
    power: clamp(aim.power, MIN_POWER, getMaxPower(health)),
  };
}

export function getLaunchVelocity(aim: AimState): Vector2 {
  const speed = aim.power * POWER_TO_SPEED_WU_PER_TICK;
  const radians = aim.elevationDegrees * DEGREES_TO_RADIANS;
  const horizontalSign = aim.facing === 'right' ? 1 : -1;

  return {
    x: horizontalSign * speed * Math.cos(radians),
    y: speed * Math.sin(radians),
  };
}

/** Shells leave the muzzle: the gun mounts on the turret's front face and points along the aim. */
export function getLaunchOrigin(
  centerX: number,
  basePositionY: number,
  aim: Pick<AimState, 'facing' | 'elevationDegrees'>
): Vector2 {
  const radians = aim.elevationDegrees * DEGREES_TO_RADIANS;
  const horizontalSign = aim.facing === 'right' ? 1 : -1;

  return {
    x: centerX + horizontalSign * (GUN_MOUNT_OFFSET_WU + Math.cos(radians) * GUN_BARREL_LENGTH_WU),
    y: basePositionY + GUN_PIVOT_ABOVE_BASE_WU + Math.sin(radians) * GUN_BARREL_LENGTH_WU,
  };
}

function getWallRestitution(wallMode: ResolvedWallMode): number {
  switch (wallMode) {
    case 'padded':
      return PADDED_WALL_RESTITUTION;
    case 'rubber':
      return RUBBER_WALL_RESTITUTION;
    case 'spring':
      return SPRING_WALL_RESTITUTION;
    case 'none':
    case 'concrete':
    case 'wrap':
      return 0;
    default:
      return assertNever(wallMode);
  }
}

function getTrackingMargin(environment: BallisticsEnvironment): number {
  return environment.isBordersExtendEnabled ? BORDERS_EXTEND_MARGIN_WU : 0;
}

/**
 * Modes with no walls of their own: the shot is tracked until it leaves the field plus the
 * Borders Extend margin. WRAP shares this ceiling because wrapping the top onto the ground has
 * no sensible counterpart — its left and right edges are what wrap.
 */
function resolveOpenBoundary(
  state: ProjectileState,
  environment: BallisticsEnvironment,
  isHorizontalOpen: boolean
): ProjectileStepResult {
  const margin = getTrackingMargin(environment);
  const isOutsideHorizontally =
    isHorizontalOpen &&
    (state.position.x < -margin || state.position.x > environment.fieldWidthWu + margin);
  const isOutsideVertically =
    state.position.y < 0 || state.position.y > environment.fieldHeightWu + margin;

  return {
    state,
    outcome: isOutsideHorizontally || isOutsideVertically ? 'lost' : 'flying',
    bounceSide: undefined,
  };
}

function resolveConcreteWalls(
  state: ProjectileState,
  environment: BallisticsEnvironment
): ProjectileStepResult {
  if (state.position.y < 0) {
    return { state, outcome: 'lost', bounceSide: undefined };
  }

  const isAbsorbed =
    state.position.x <= 0 ||
    state.position.x >= environment.fieldWidthWu ||
    state.position.y >= environment.fieldHeightWu;

  if (!isAbsorbed) {
    return { state, outcome: 'flying', bounceSide: undefined };
  }

  return {
    state: {
      position: {
        x: clamp(state.position.x, 0, environment.fieldWidthWu),
        y: Math.min(state.position.y, environment.fieldHeightWu),
      },
      velocity: state.velocity,
    },
    outcome: 'absorbed',
    bounceSide: undefined,
  };
}

function resolveBouncyWalls(
  state: ProjectileState,
  environment: BallisticsEnvironment
): ProjectileStepResult {
  const restitution = getWallRestitution(environment.wallMode);
  let { x, y } = state.position;
  let velocityX = state.velocity.x;
  let velocityY = state.velocity.y;
  let bounceSide: WallSide | undefined;

  if (x < 0) {
    x = -x;
    velocityX = -velocityX * restitution;
    bounceSide = 'left';
  } else if (x > environment.fieldWidthWu) {
    x = 2 * environment.fieldWidthWu - x;
    velocityX = -velocityX * restitution;
    bounceSide = 'right';
  }

  if (y > environment.fieldHeightWu) {
    y = 2 * environment.fieldHeightWu - y;
    velocityY = -velocityY * restitution;
    bounceSide = 'top';
  }

  return {
    state: { position: { x, y }, velocity: { x: velocityX, y: velocityY } },
    outcome: y < 0 ? 'lost' : 'flying',
    bounceSide,
  };
}

function resolveWrapWalls(
  state: ProjectileState,
  environment: BallisticsEnvironment
): ProjectileStepResult {
  const width = environment.fieldWidthWu;
  let { x } = state.position;

  while (x < 0) {
    x += width;
  }

  while (x > width) {
    x -= width;
  }

  const wrapped: ProjectileState = {
    position: { x, y: state.position.y },
    velocity: state.velocity,
  };

  return resolveOpenBoundary(wrapped, environment, false);
}

function resolveWalls(
  state: ProjectileState,
  environment: BallisticsEnvironment
): ProjectileStepResult {
  switch (environment.wallMode) {
    case 'none':
      return resolveOpenBoundary(state, environment, true);
    case 'concrete':
      return resolveConcreteWalls(state, environment);
    case 'padded':
    case 'rubber':
    case 'spring':
      return resolveBouncyWalls(state, environment);
    case 'wrap':
      return resolveWrapWalls(state, environment);
    default:
      return assertNever(environment.wallMode);
  }
}

/** One 60 Hz integration step: accelerate, damp, advance, then let the walls have their say. */
export function stepProjectile(
  state: ProjectileState,
  environment: BallisticsEnvironment
): ProjectileStepResult {
  const damping = Math.max(0, 1 - environment.viscosity * VISCOSITY_DAMPING_PER_UNIT);
  const velocity: Vector2 = {
    x: (state.velocity.x + environment.windAccelerationWuPerTickSquared) * damping,
    y: (state.velocity.y - environment.gravityWuPerTickSquared) * damping,
  };
  const advanced: ProjectileState = {
    position: { x: state.position.x + velocity.x, y: state.position.y + velocity.y },
    velocity,
  };

  return resolveWalls(advanced, environment);
}

/** [MANUAL §5] Apex is the tick the vertical velocity stops rising — where a MIRV splits. */
export function hasCrossedApex(previousVelocityY: number, velocityY: number): boolean {
  return previousVelocityY > 0 && velocityY <= 0;
}

function advanceAlong(from: Vector2, direction: Vector2, distance: number): Vector2 {
  return { x: from.x + direction.x * distance, y: from.y + direction.y * distance };
}

function normalize(vector: Vector2): Vector2 {
  const length = Math.hypot(vector.x, vector.y);

  return length === 0 ? { x: 0, y: -1 } : { x: vector.x / length, y: vector.y / length };
}

function traceTunnelDepth(field: Heightfield, contact: Vector2, direction: Vector2): Vector2 {
  let deepest = contact;

  for (let depth = IMPACT_TRACE_STEP_WU; depth <= PROJECTILE_TUNNEL_DEPTH_WU; depth++) {
    const probe = advanceAlong(contact, direction, depth);

    if (!isSolidAt(field, probe.x, probe.y)) {
      return deepest;
    }

    deepest = probe;
  }

  return deepest;
}

/**
 * [MANUAL §5] A shell burrows before detonating unless a Contact Trigger forces it to go off on
 * contact; the trigger covers every sub-warhead of the shot, so it travels on the projectile.
 */
export function traceTerrainImpact(
  field: Heightfield,
  from: Vector2,
  to: Vector2,
  options: ImpactTraceOptions
): Vector2 | undefined {
  const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);
  const direction = normalize({ x: to.x - from.x, y: to.y - from.y });
  const stepCount = Math.max(1, Math.ceil(segmentLength / IMPACT_TRACE_STEP_WU));

  for (let step = 1; step <= stepCount; step++) {
    const probe = advanceAlong(from, direction, (segmentLength * step) / stepCount);

    // The floor is bedrock: inside the field a shell detonates on it and never burrows into it.
    if (probe.y <= 0 && probe.x >= 0 && probe.x <= field.length) {
      return { x: probe.x, y: 0 };
    }

    if (!isSolidAt(field, probe.x, probe.y)) {
      continue;
    }

    if (options.hasContactTrigger || !options.isTunnelingEnabled) {
      return probe;
    }

    return traceTunnelDepth(field, probe, direction);
  }

  return undefined;
}

/**
 * Replays a whole shot without touching the world — the AI's aim search and the mobile
 * trajectory ghost both read from it, so it must stay allocation-cheap and side-effect free.
 */
export function simulateTrajectory(
  origin: Vector2,
  velocity: Vector2,
  environment: BallisticsEnvironment,
  field: Heightfield | undefined,
  maxTicks: number = MAX_FLIGHT_TICKS
): TrajectoryResult {
  const path: Vector2[] = [origin];
  let state: ProjectileState = { position: origin, velocity };

  for (let tickIndex = 0; tickIndex < maxTicks; tickIndex++) {
    const previousPosition = state.position;
    const stepResult = stepProjectile(state, environment);

    state = stepResult.state;
    path.push(state.position);

    if (field !== undefined && stepResult.bounceSide === undefined) {
      const impact = traceTerrainImpact(field, previousPosition, state.position, {
        isTunnelingEnabled: false,
        hasContactTrigger: true,
      });

      if (impact !== undefined) {
        return { path, impact, outcome: 'impact', tickCount: tickIndex + 1 };
      }
    }

    if (stepResult.outcome === 'absorbed') {
      return { path, impact: undefined, outcome: 'absorbed', tickCount: tickIndex + 1 };
    }

    if (stepResult.outcome === 'lost') {
      return { path, impact: undefined, outcome: 'lost', tickCount: tickIndex + 1 };
    }
  }

  return { path, impact: undefined, outcome: 'expired', tickCount: maxTicks };
}
