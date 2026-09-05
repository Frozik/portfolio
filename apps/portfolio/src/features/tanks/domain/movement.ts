import {
  CELL_SIZE_WU,
  ICE_SLIDE_BUDGET_WU,
  ICE_SLIDE_INPUT_LOCK_WU,
  TANK_SIZE_WU,
  TANK_SPEED_PLAYER_WU_PER_SECOND,
  TICKS_PER_SECOND,
} from './constants';
import { getDirectionDelta, isQuarterTurn } from './direction';
import type { Terrain } from './terrain';
import type { Direction, PlayerInputs, PlayerTank } from './types';

export interface TankBox {
  readonly positionX: number;
  readonly positionY: number;
}

export interface MovableTank {
  positionX: number;
  positionY: number;
  direction: Direction;
  movementRemainder: number;
}

export interface IMovementContext {
  readonly terrain: Terrain;
  /** Tanks other than the one being moved — they block, never push. */
  readonly blockers: readonly TankBox[];
}

export interface TankStepResult {
  readonly positionX: number;
  readonly positionY: number;
  readonly stepsMoved: number;
  readonly isBlocked: boolean;
}

export interface MovementAccumulatorResult {
  readonly steps: number;
  readonly remainder: number;
}

export function rectanglesOverlap(
  firstX: number,
  firstY: number,
  firstSizeWu: number,
  secondX: number,
  secondY: number,
  secondSizeWu: number
): boolean {
  return (
    firstX < secondX + secondSizeWu &&
    secondX < firstX + firstSizeWu &&
    firstY < secondY + secondSizeWu &&
    secondY < firstY + firstSizeWu
  );
}

export function boxesOverlap(
  firstX: number,
  firstY: number,
  secondX: number,
  secondY: number,
  sizeWu: number
): boolean {
  return rectanglesOverlap(firstX, firstY, sizeWu, secondX, secondY, sizeWu);
}

/** The original's "teleport": a 90° turn snaps to the 8-wu grid, moving the tank up to ±4 wu. */
export function snapCoordinateOnTurn(coordinate: number): number {
  return Math.round(coordinate / CELL_SIZE_WU) * CELL_SIZE_WU;
}

/** Sub-unit accumulator: whole wu leave the accumulator, the fraction stays. */
export function accumulateMovementSteps(
  remainder: number,
  speedWuPerSecond: number
): MovementAccumulatorResult {
  const advanced = remainder + speedWuPerSecond / TICKS_PER_SECOND;
  const steps = Math.floor(advanced);

  return { steps, remainder: advanced - steps };
}

export function canTankOccupy(
  context: IMovementContext,
  positionX: number,
  positionY: number
): boolean {
  const { widthWu, heightWu } = context.terrain.geometry;

  if (
    positionX < 0 ||
    positionY < 0 ||
    positionX + TANK_SIZE_WU > widthWu ||
    positionY + TANK_SIZE_WU > heightWu
  ) {
    return false;
  }

  if (context.terrain.isBoxBlockedForTank(positionX, positionY, TANK_SIZE_WU)) {
    return false;
  }

  return !context.blockers.some(blocker =>
    boxesOverlap(positionX, positionY, blocker.positionX, blocker.positionY, TANK_SIZE_WU)
  );
}

/** Applies up to `maxSteps` single-wu steps, stopping at the first blocked one. */
export function stepTank(
  context: IMovementContext,
  positionX: number,
  positionY: number,
  direction: Direction,
  maxSteps: number
): TankStepResult {
  const delta = getDirectionDelta(direction);
  let currentX = positionX;
  let currentY = positionY;

  for (let step = 0; step < maxSteps; step++) {
    const nextX = currentX + delta.x;
    const nextY = currentY + delta.y;

    if (!canTankOccupy(context, nextX, nextY)) {
      return { positionX: currentX, positionY: currentY, stepsMoved: step, isBlocked: true };
    }

    currentX = nextX;
    currentY = nextY;
  }

  return { positionX: currentX, positionY: currentY, stepsMoved: maxSteps, isBlocked: false };
}

export function isTankOnIce(terrain: Terrain, positionX: number, positionY: number): boolean {
  return terrain.isBoxOverKind(positionX, positionY, TANK_SIZE_WU, 'ice');
}

/** Turns the tank (snapping on 90° turns) and advances it by this tick's accumulated steps. */
export function advanceTank(
  tank: MovableTank,
  direction: Direction,
  speedWuPerSecond: number,
  context: IMovementContext
): TankStepResult {
  if (isQuarterTurn(tank.direction, direction)) {
    tank.positionX = snapCoordinateOnTurn(tank.positionX);
    tank.positionY = snapCoordinateOnTurn(tank.positionY);
  }

  tank.direction = direction;

  const { steps, remainder } = accumulateMovementSteps(tank.movementRemainder, speedWuPerSecond);
  tank.movementRemainder = remainder;

  const result = stepTank(context, tank.positionX, tank.positionY, direction, steps);
  tank.positionX = result.positionX;
  tank.positionY = result.positionY;

  return result;
}

function stopIceSlide(player: PlayerTank): void {
  player.isIceSliding = false;
  player.iceSlideBudgetWu = 0;
}

function coastOnIce(player: PlayerTank, context: IMovementContext): void {
  player.isIceSliding = true;

  const { steps, remainder } = accumulateMovementSteps(
    player.movementRemainder,
    TANK_SPEED_PLAYER_WU_PER_SECOND
  );
  player.movementRemainder = remainder;

  const result = stepTank(
    context,
    player.positionX,
    player.positionY,
    player.iceSlideDirection,
    Math.min(steps, player.iceSlideBudgetWu)
  );
  player.positionX = result.positionX;
  player.positionY = result.positionY;
  player.iceSlideBudgetWu -= result.stepsMoved;

  if (
    result.isBlocked ||
    player.iceSlideBudgetWu <= 0 ||
    !isTankOnIce(context.terrain, player.positionX, player.positionY)
  ) {
    stopIceSlide(player);
  }
}

/** Ice keeps re-arming a 28-wu coast budget; new input only takes hold after the first 13 wu. */
export function updatePlayerMovement(
  player: PlayerTank,
  inputs: PlayerInputs,
  context: IMovementContext
): void {
  const requestedDirection = inputs.direction;
  const hasSlideBudget =
    player.iceSlideBudgetWu > 0 && isTankOnIce(context.terrain, player.positionX, player.positionY);
  const slideConsumedWu = ICE_SLIDE_BUDGET_WU - player.iceSlideBudgetWu;
  const isSteeringLocked = slideConsumedWu < ICE_SLIDE_INPUT_LOCK_WU;
  const keepsSlideDirection = requestedDirection === player.iceSlideDirection;

  if (
    hasSlideBudget &&
    !keepsSlideDirection &&
    (requestedDirection === undefined || isSteeringLocked)
  ) {
    coastOnIce(player, context);

    return;
  }

  if (requestedDirection === undefined) {
    stopIceSlide(player);
    player.movementRemainder = 0;

    return;
  }

  player.isIceSliding = false;
  advanceTank(player, requestedDirection, TANK_SPEED_PLAYER_WU_PER_SECOND, context);

  if (isTankOnIce(context.terrain, player.positionX, player.positionY)) {
    player.iceSlideDirection = requestedDirection;
    player.iceSlideBudgetWu = ICE_SLIDE_BUDGET_WU;
  } else {
    player.iceSlideBudgetWu = 0;
  }
}
