import type { IAction, IHumanPlayer } from '../types';
import { EPlayerType } from '../types';

export const VELOCITY_COEFFICIENT = 0.2;

export class HumanPlayer implements IHumanPlayer {
  readonly type = EPlayerType.Human;
  readonly name = 'Human';

  private readonly pressedKeys = new Set<string>();

  constructor() {
    window.addEventListener('keydown', this.handleKeyDownEvent);
    window.addEventListener('keyup', this.handleKeyUpEvent);
  }

  public play(): IAction {
    let carVelocity = 0;

    if (this.pressedKeys.has('ArrowLeft')) {
      carVelocity--;
    }
    if (this.pressedKeys.has('ArrowRight')) {
      carVelocity++;
    }

    if (this.pressedKeys.has('ShiftLeft') || this.pressedKeys.has('ShiftRight')) {
      carVelocity *= 5;
    }

    return { pivotVelocity: carVelocity * VELOCITY_COEFFICIENT };
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDownEvent);
    window.removeEventListener('keyup', this.handleKeyUpEvent);
  }

  private readonly handleKeyDownEvent = ({ code }: KeyboardEvent) => this.pressedKeys.add(code);

  private readonly handleKeyUpEvent = ({ code }: KeyboardEvent) => this.pressedKeys.delete(code);
}
