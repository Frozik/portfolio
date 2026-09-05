import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil, random } from 'lodash-es';
import {
  AGGRESSION_CHASE_PHASE_INTERVAL_MULTIPLIER,
  AGGRESSION_HUNT_PHASE_INTERVAL_MULTIPLIER,
  CELL_SIZE_WU,
  ENEMY_BLOCKED_REACTION_DENOMINATOR,
  ENEMY_BLOCKED_REVERSE_DRAW,
  ENEMY_BRAKE_TICKS,
  ENEMY_CRUISE_DECISION_DENOMINATOR,
  ENEMY_FIRE_DENOMINATOR,
  PLAYER_SLOT_COUNT,
  TANK_SIZE_WU,
} from './constants';
import { DIRECTIONS, getOppositeDirection, getSideDirections } from './direction';

import type { Direction, EnemyTank } from './types';

export type AggressionPhase = 'wander' | 'chase-player' | 'hunt-base';

export interface IEnemyAiContext {
  readonly ticksSinceStageStart: number;
  readonly spawnIntervalTicks: number;
  /** Center of each living player tank, indexed by player slot; empty slots are undefined. */
  readonly playerCenters: readonly (Vector2 | undefined)[];
  readonly baseCenter: Vector2;
}

export interface EnemyDecision {
  readonly direction: Direction;
  readonly fire: boolean;
}

export type BlockedReaction =
  | { readonly kind: 'brake'; readonly ticks: number }
  | { readonly kind: 'turn'; readonly direction: Direction };

const HALF_CHANCE_DENOMINATOR = 2;

function isDrawHit(denominator: number): boolean {
  return random(denominator - 1) === 0;
}

function pickRandomDirection(): Direction {
  return DIRECTIONS[random(DIRECTIONS.length - 1)];
}

export function isAlignedToGrid(positionX: number, positionY: number): boolean {
  return positionX % CELL_SIZE_WU === 0 && positionY % CELL_SIZE_WU === 0;
}

export function getAggressionPhase(
  ticksSinceStageStart: number,
  spawnIntervalTicks: number
): AggressionPhase {
  if (ticksSinceStageStart <= AGGRESSION_CHASE_PHASE_INTERVAL_MULTIPLIER * spawnIntervalTicks) {
    return 'wander';
  }

  if (ticksSinceStageStart <= AGGRESSION_HUNT_PHASE_INTERVAL_MULTIPLIER * spawnIntervalTicks) {
    return 'chase-player';
  }

  return 'hunt-base';
}

function getChaseTarget(enemySlot: number, context: IEnemyAiContext): Vector2 | undefined {
  const preferredSlot = enemySlot % PLAYER_SLOT_COUNT;

  return (
    context.playerCenters[preferredSlot] ?? context.playerCenters.find(center => !isNil(center))
  );
}

/** Turns a target offset into a direction, preferring one axis at random as the ROM does. */
function getDirectionTowards(from: Vector2, target: Vector2): Direction {
  const deltaX = target.x - from.x;
  const deltaY = target.y - from.y;

  if (deltaX === 0 && deltaY === 0) {
    return pickRandomDirection();
  }

  const prefersVertical = deltaX === 0 || (deltaY !== 0 && isDrawHit(HALF_CHANCE_DENOMINATOR));

  if (prefersVertical) {
    return deltaY < 0 ? 'up' : 'down';
  }

  return deltaX < 0 ? 'left' : 'right';
}

function getEnemyCenter(enemy: EnemyTank): Vector2 {
  return {
    x: enemy.positionX + TANK_SIZE_WU / 2,
    y: enemy.positionY + TANK_SIZE_WU / 2,
  };
}

/** The stage-time state machine: wander → chase a player → converge on the base. */
export function selectAggressiveDirection(enemy: EnemyTank, context: IEnemyAiContext): Direction {
  const phase = getAggressionPhase(context.ticksSinceStageStart, context.spawnIntervalTicks);

  switch (phase) {
    case 'wander':
      return pickRandomDirection();
    case 'chase-player': {
      const target = getChaseTarget(enemy.slot, context);

      return isNil(target)
        ? pickRandomDirection()
        : getDirectionTowards(getEnemyCenter(enemy), target);
    }
    case 'hunt-base':
      return getDirectionTowards(getEnemyCenter(enemy), context.baseCenter);
    default:
      return assertNever(phase);
  }
}

/** An aligned enemy re-picks direction with p = 1/16 and fires with p = 1/32. */
export function decideEnemyAction(
  enemy: EnemyTank,
  context: IEnemyAiContext,
  hasLiveBullet: boolean
): EnemyDecision {
  const canReDecide =
    isAlignedToGrid(enemy.positionX, enemy.positionY) &&
    isDrawHit(ENEMY_CRUISE_DECISION_DENOMINATOR);
  const direction = canReDecide ? selectAggressiveDirection(enemy, context) : enemy.direction;
  const fire = !hasLiveBullet && isDrawHit(ENEMY_FIRE_DENOMINATOR);

  return { direction, fire };
}

/** 3 draws of 4 brake and keep pushing — the original's bumping stutter; the fourth reverses. */
export function decideBlockedReaction(enemy: EnemyTank, context: IEnemyAiContext): BlockedReaction {
  const draw = random(ENEMY_BLOCKED_REACTION_DENOMINATOR - 1);

  if (draw !== ENEMY_BLOCKED_REVERSE_DRAW) {
    return { kind: 'brake', ticks: ENEMY_BRAKE_TICKS };
  }

  if (!isAlignedToGrid(enemy.positionX, enemy.positionY)) {
    return { kind: 'turn', direction: getOppositeDirection(enemy.direction) };
  }

  if (isDrawHit(HALF_CHANCE_DENOMINATOR)) {
    const [counterClockwise, clockwise] = getSideDirections(enemy.direction);

    return {
      kind: 'turn',
      direction: isDrawHit(HALF_CHANCE_DENOMINATOR) ? counterClockwise : clockwise,
    };
  }

  return { kind: 'turn', direction: selectAggressiveDirection(enemy, context) };
}
