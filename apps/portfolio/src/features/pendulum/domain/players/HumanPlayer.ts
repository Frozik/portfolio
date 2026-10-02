import { isNil } from 'lodash-es';

import type { IKeyStateSource } from '../ports/key-state-source';
import type { IAction, IHumanPlayer, IWorld } from '../types';
import { EPlayerType } from '../types';

export const HUMAN_PLAYER_NAME = 'Human';

const VELOCITY_COEFFICIENT = 0.2;
const SHIFT_SPEED_MULTIPLIER = 5;

export class HumanPlayer implements IHumanPlayer {
  readonly type = EPlayerType.Human;
  readonly name = HUMAN_PLAYER_NAME;

  constructor(
    private readonly keyState: IKeyStateSource,
    /** The rail position a held pointer drags the cart to, `undefined` while nothing is held. */
    private readonly dragTarget: () => number | undefined
  ) {}

  play(world: IWorld, deltaTime: DOMHighResTimeStamp): IAction {
    const target = this.dragTarget();

    if (!isNil(target) && deltaTime > 0) {
      return { pivotVelocity: (target - world.pivotX) / deltaTime };
    }

    let carVelocity = 0;

    if (this.keyState.isPressed('ArrowLeft')) {
      carVelocity--;
    }
    if (this.keyState.isPressed('ArrowRight')) {
      carVelocity++;
    }

    if (this.keyState.isPressed('ShiftLeft') || this.keyState.isPressed('ShiftRight')) {
      carVelocity *= SHIFT_SPEED_MULTIPLIER;
    }

    return { pivotVelocity: carVelocity * VELOCITY_COEFFICIENT };
  }

  dispose(): void {
    this.keyState.dispose();
  }
}
