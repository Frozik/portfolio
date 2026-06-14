import type { IAction, IHumanPlayer } from '../types';
import { EPlayerType } from '../types';
import type { IKeyStateSource } from './IKeyStateSource';

export const VELOCITY_COEFFICIENT = 0.2;
const SHIFT_SPEED_MULTIPLIER = 5;

export class HumanPlayer implements IHumanPlayer {
  readonly type = EPlayerType.Human;
  readonly name = 'Human';

  constructor(private readonly keyState: IKeyStateSource) {}

  public play(): IAction {
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

  public dispose(): void {
    this.keyState.dispose();
  }
}
