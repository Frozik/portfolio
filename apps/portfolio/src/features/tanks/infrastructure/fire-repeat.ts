/**
 * Holding re-raises the domain's rising edge every `FIRE_REPEAT_TICKS`. The repeat lives in the
 * input sources, not the domain — domain tests keep pure edge semantics.
 */
export const FIRE_REPEAT_TICKS = 8;

const FIRST_HOLD_TICK = 0;

/** Turns a held-button level signal into the repeated rising edges the domain consumes. */
export class FireRepeater {
  private holdTicks = FIRST_HOLD_TICK;

  read(isHeld: boolean): boolean {
    const isEdge = isHeld && this.holdTicks % FIRE_REPEAT_TICKS === FIRST_HOLD_TICK;

    this.holdTicks = isHeld ? this.holdTicks + 1 : FIRST_HOLD_TICK;

    return isEdge;
  }

  reset(): void {
    this.holdTicks = FIRST_HOLD_TICK;
  }
}
