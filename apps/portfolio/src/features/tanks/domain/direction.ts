import { assertNever } from '@frozik/utils/assert/assertNever';

import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Direction } from './types';

/** Clockwise order — turning to an adjacent entry is a 90° turn. */
export const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left'];

export function getDirectionDelta(direction: Direction): Vector2 {
  switch (direction) {
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    default:
      return assertNever(direction);
  }
}

export function isHorizontalDirection(direction: Direction): boolean {
  switch (direction) {
    case 'left':
    case 'right':
      return true;
    case 'up':
    case 'down':
      return false;
    default:
      return assertNever(direction);
  }
}

export function getOppositeDirection(direction: Direction): Direction {
  switch (direction) {
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    default:
      return assertNever(direction);
  }
}

/** The two 90° turns available from `direction`, as [counter-clockwise, clockwise]. */
export function getSideDirections(direction: Direction): readonly [Direction, Direction] {
  switch (direction) {
    case 'up':
      return ['left', 'right'];
    case 'down':
      return ['right', 'left'];
    case 'left':
      return ['down', 'up'];
    case 'right':
      return ['up', 'down'];
    default:
      return assertNever(direction);
  }
}

export function isQuarterTurn(from: Direction, to: Direction): boolean {
  return from !== to && to !== getOppositeDirection(from);
}
