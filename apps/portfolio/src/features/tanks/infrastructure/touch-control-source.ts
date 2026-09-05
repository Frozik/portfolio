import type { IInputSource } from '../domain/ports/input-source';
import type { Direction, PlayerInputs } from '../domain/types';
import { FireRepeater } from './fire-repeat';

/** What the `TouchControls` overlay writes into; the source itself never touches the DOM. */
export interface ITouchControlInput {
  setDirection(direction: Direction | undefined): void;
  setFire(isPressed: boolean): void;
  /** Drops every held zone — used when the overlay unmounts or the run restarts. */
  release(): void;
}

/** Fire follows the keyboard's repeat semantics, so a held button behaves identically (§12.2). */
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
