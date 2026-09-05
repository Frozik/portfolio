import type { IInputSource } from '../domain/ports/input-source';
import type { ITouchControlInput } from '../domain/ports/touch-control-input';
import type { Direction, PlayerInputs } from '../domain/types';
import { FireRepeater } from './fire-repeat';

/** Fire follows the keyboard's repeat semantics, so a held button behaves identically. */
export class TouchControlSource implements IInputSource, ITouchControlInput {
  private readonly fireRepeater = new FireRepeater();
  private heldDirection: Direction | undefined;
  private isFirePressed = false;

  read(): PlayerInputs {
    return {
      direction: this.heldDirection,
      fire: this.fireRepeater.read(this.isFirePressed),
    };
  }

  setDirection(direction: Direction | undefined): void {
    this.heldDirection = direction;
  }

  setFire(isPressed: boolean): void {
    this.isFirePressed = isPressed;
  }

  release(): void {
    this.heldDirection = undefined;
    this.isFirePressed = false;
    this.fireRepeater.reset();
  }

  dispose(): void {
    this.release();
  }
}
