import { assertNever } from '@frozik/utils/assert/assertNever';
import { clamp, random } from 'lodash-es';

import {
  BORDERS_EXTEND_MARGIN_WU,
  PADDED_WALL_RESTITUTION,
  RESOLVABLE_WALL_MODES,
  RUBBER_WALL_RESTITUTION,
  SPRING_WALL_RESTITUTION,
} from './constants';
import type { ProjectileState, ResolvedWallMode, WallMode, WallSide } from './types';

/** The part of the ballistics environment the field's edges are decided by. */
export interface WallEnvironment {
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

function getTrackingMargin(environment: WallEnvironment): number {
  return environment.isBordersExtendEnabled ? BORDERS_EXTEND_MARGIN_WU : 0;
}

/**
 * Modes with no walls of their own: the shot is tracked until it leaves the field plus the
 * Borders Extend margin. WRAP shares this ceiling because wrapping the top onto the ground has
 * no sensible counterpart — its left and right edges are what wrap.
 */
function resolveOpenBoundary(
  state: ProjectileState,
  environment: WallEnvironment,
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
  environment: WallEnvironment
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
  environment: WallEnvironment
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
  environment: WallEnvironment
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

export function resolveWalls(
  state: ProjectileState,
  environment: WallEnvironment
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
