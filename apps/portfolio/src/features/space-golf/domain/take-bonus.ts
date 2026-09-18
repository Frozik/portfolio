import { assertNever } from '@frozik/utils/assert/assertNever';

import type { BallState } from './ball';
import { taken } from './bonus';
import { GRIP_TOUCHES, MAX_FORESIGHT } from './constants';

/** What a ball that has just flown through the bonus has of it: the disc gone, and what its kind gives — at once. */
export function withBonusTaken(ball: BallState): Pick<BallState, 'bonus' | 'foresight' | 'grip'> {
  const { kind } = ball.bonus;
  switch (kind) {
    case 'foresight':
      return {
        bonus: taken(ball.bonus),
        foresight: Math.min(ball.foresight + 1, MAX_FORESIGHT),
        grip: ball.grip,
      };
    case 'grip':
      return {
        bonus: taken(ball.bonus),
        foresight: ball.foresight,
        grip: ball.grip + GRIP_TOUCHES,
      };
    default:
      return assertNever(kind);
  }
}
