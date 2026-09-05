import type { DragAim, IScorchedInputSource, ScorchedInput } from '../domain/scorched-input';

/** The write end the touch overlay and the canvas drag handler push into. */
export interface IPointerAimInput {
  /** Absolute aim from a drag; `undefined` ends the gesture without changing the aim. */
  setDragAim(aim: DragAim | undefined): void;
  /** One-shot nudges from the fine-tune steppers, in dial degrees and power units. */
  nudge(dialDelta: number, powerDelta: number): void;
  requestFire(): void;
  /** Drops everything held — the overlay unmounting or a round restarting must not fire. */
  release(): void;
}

/**
 * Touch and mouse aiming: a plain state holder the React overlay writes into and the draw
 * orchestrator polls once a frame, exactly like the tanks touch source. Releasing the drag never
 * fires — aiming and firing are separate acts, so a slip can never cost a turn.
 */
export class PointerAimSource implements IScorchedInputSource, IPointerAimInput {
  private dragAim: DragAim | undefined;
  private queuedDialDelta = 0;
  private queuedPowerDelta = 0;
  private isFireQueued = false;

  read(): ScorchedInput {
    const input: ScorchedInput = {
      dialDelta: this.queuedDialDelta,
      powerDelta: this.queuedPowerDelta,
      aimOverride: this.dragAim,
      isFireRequested: this.isFireQueued,
      isWeaponCycleRequested: false,
    };

    this.queuedDialDelta = 0;
    this.queuedPowerDelta = 0;
    this.isFireQueued = false;

    return input;
  }

  setDragAim(aim: DragAim | undefined): void {
    this.dragAim = aim;
  }

  nudge(dialDelta: number, powerDelta: number): void {
    this.queuedDialDelta += dialDelta;
    this.queuedPowerDelta += powerDelta;
  }

  requestFire(): void {
    this.isFireQueued = true;
  }

  release(): void {
    this.dragAim = undefined;
    this.queuedDialDelta = 0;
    this.queuedPowerDelta = 0;
    this.isFireQueued = false;
  }

  dispose(): void {
    this.release();
  }
}
