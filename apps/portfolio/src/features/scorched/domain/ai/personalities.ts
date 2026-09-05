import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { random } from 'lodash-es';

import type { BallisticsEnvironment } from '../ballistics';
import {
  MAX_ELEVATION_DEGREES,
  MIN_ELEVATION_DEGREES,
  MIN_POWER,
  MIN_VISCOSITY,
} from '../constants';
import type { Heightfield } from '../terrain/heightfield';
import { isSolidAt } from '../terrain/heightfield';
import type { AimState, AiPersonality, PlayerId, ResolvedWallMode } from '../types';
import {
  findBankShotAim,
  hasClearLineOfFire,
  refineAimForWind,
  refineFromMiss,
  solveNoDragAim,
} from './aim-solver';

export interface AiTankView {
  readonly playerId: PlayerId;
  readonly position: Vector2;
  readonly health: number;
  readonly kills: number;
}

interface PreviousShotMemory {
  readonly aim: AimState;
  readonly impact: Vector2;
  readonly targetId: PlayerId;
}

export interface AiContext {
  readonly self: AiTankView;
  readonly opponents: readonly AiTankView[];
  readonly environment: BallisticsEnvironment;
  readonly field: Heightfield;
  readonly maxPower: number;
  readonly previousShot: PreviousShotMemory | undefined;
  /** [MANUAL §9] Cyborg holds a grudge against whoever last hit it. */
  readonly lastAttackerId: PlayerId | undefined;
}

export type DisclosedPersonality = Exclude<AiPersonality, 'unknown'>;

/** The seven strategies an Unknown opponent can secretly turn out to be. */
const DISCLOSED_PERSONALITIES: readonly DisclosedPersonality[] = [
  'moron',
  'shooter',
  'poolshark',
  'tosser',
  'chooser',
  'spoiler',
  'cyborg',
];

const BOUNCY_WALL_MODES: readonly ResolvedWallMode[] = ['padded', 'rubber', 'spring'];

export function isBouncyWallMode(wallMode: ResolvedWallMode): boolean {
  return BOUNCY_WALL_MODES.includes(wallMode);
}

/** [MANUAL §9] Moron: a fresh random angle and power every single shot. */
export function createRandomAim(maxPower: number): AimState {
  return {
    facing: random(0, 1) === 0 ? 'left' : 'right',
    elevationDegrees: random(MIN_ELEVATION_DEGREES, MAX_ELEVATION_DEGREES),
    power: random(MIN_POWER, maxPower),
  };
}

function getDistance(from: Vector2, to: Vector2): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function selectNearestTarget(context: AiContext): AiTankView | undefined {
  return context.opponents.reduce<AiTankView | undefined>(
    (nearest, candidate) =>
      nearest === undefined ||
      getDistance(context.self.position, candidate.position) <
        getDistance(context.self.position, nearest.position)
        ? candidate
        : nearest,
    undefined
  );
}

/** [MANUAL §9] Cyborg picks a grudge first, then the weakest tank, then whoever is winning. */
function selectVindictiveTarget(context: AiContext): AiTankView | undefined {
  const attacker = context.opponents.find(opponent => opponent.playerId === context.lastAttackerId);

  if (attacker !== undefined) {
    return attacker;
  }

  return context.opponents.reduce<AiTankView | undefined>(
    (best, candidate) =>
      best === undefined ||
      candidate.health < best.health ||
      (candidate.health === best.health && candidate.kills > best.kills)
        ? candidate
        : best,
    undefined
  );
}

export function selectTarget(
  personality: AiPersonality,
  context: AiContext
): AiTankView | undefined {
  return personality === 'cyborg' ? selectVindictiveTarget(context) : selectNearestTarget(context);
}

function hasLineOfFire(context: AiContext, target: AiTankView): boolean {
  return hasClearLineOfFire(context.self.position, target.position, position =>
    isSolidAt(context.field, position.x, position.y)
  );
}

/** [MANUAL §9] Shooter: solves the shot, but only when nothing stands in the way. */
function decideShooterAim(context: AiContext, target: AiTankView): AimState {
  if (!hasLineOfFire(context, target)) {
    return createRandomAim(context.maxPower);
  }

  return (
    solveNoDragAim(
      context.self.position,
      target.position,
      context.environment.gravityWuPerTickSquared,
      context.maxPower
    ) ?? createRandomAim(context.maxPower)
  );
}

/** [MANUAL §9] Poolshark: a Shooter that also works the walls when they can be worked. */
function decidePoolsharkAim(context: AiContext, target: AiTankView): AimState {
  if (hasLineOfFire(context, target)) {
    return decideShooterAim(context, target);
  }

  if (!isBouncyWallMode(context.environment.wallMode)) {
    return createRandomAim(context.maxPower);
  }

  return (
    findBankShotAim(
      context.self.position,
      target.position,
      context.environment,
      context.field,
      context.maxPower
    ) ?? createRandomAim(context.maxPower)
  );
}

/** [MANUAL §9] Tosser: starts wild and walks its shots onto the target round by round. */
function decideTosserAim(context: AiContext, target: AiTankView): AimState {
  const memory = context.previousShot;

  if (memory === undefined || memory.targetId !== target.playerId) {
    return createRandomAim(context.maxPower);
  }

  return refineFromMiss(
    memory.aim,
    context.self.position,
    memory.impact,
    target.position,
    context.maxPower
  );
}

/** [MANUAL §9] Chooser: whichever of the simpler strategies the situation calls for. */
function decideChooserAim(context: AiContext, target: AiTankView): AimState {
  if (hasLineOfFire(context, target)) {
    return decideShooterAim(context, target);
  }

  if (isBouncyWallMode(context.environment.wallMode)) {
    return decidePoolsharkAim(context, target);
  }

  return decideTosserAim(context, target);
}

/**
 * [MANUAL §9] Spoiler: near-perfect wind and gravity compensation that is blind to air
 * viscosity. It plans in a drag-free copy of the world, so once viscosity is switched on its
 * shots fall short by exactly the drag it refused to model — the manual's stated weakness.
 */
function decideSpoilerAim(context: AiContext, target: AiTankView): AimState {
  const dragFreeEnvironment: BallisticsEnvironment = {
    ...context.environment,
    viscosity: MIN_VISCOSITY,
  };

  return (
    refineAimForWind(
      context.self.position,
      target.position,
      dragFreeEnvironment,
      context.field,
      context.maxPower
    ) ?? createRandomAim(context.maxPower)
  );
}

function decideAimForTarget(
  personality: DisclosedPersonality,
  context: AiContext,
  target: AiTankView
): AimState {
  switch (personality) {
    case 'moron':
      return createRandomAim(context.maxPower);
    case 'shooter':
      return decideShooterAim(context, target);
    case 'poolshark':
      return decidePoolsharkAim(context, target);
    case 'tosser':
      return decideTosserAim(context, target);
    case 'chooser':
      return decideChooserAim(context, target);
    case 'spoiler':
    case 'cyborg':
      return decideSpoilerAim(context, target);
    default:
      return assertNever(personality);
  }
}

/** [MANUAL §9] Unknown never tells you which of the others it is. */
export function resolveUnknownPersonality(): DisclosedPersonality {
  return DISCLOSED_PERSONALITIES[random(DISCLOSED_PERSONALITIES.length - 1)];
}

export function decideAim(personality: AiPersonality, context: AiContext): AimState {
  const disclosed = personality === 'unknown' ? resolveUnknownPersonality() : personality;
  const target = selectTarget(disclosed, context);

  if (target === undefined) {
    return createRandomAim(context.maxPower);
  }

  return decideAimForTarget(disclosed, context, target);
}
