import type { WorldEvent } from '../domain/types';

const NO_EVENTS: readonly WorldEvent[] = [];

/**
 * Events produced outside the tick loop — a HUD action, a round opening — still have to reach
 * the renderer's single funnel, because the helicopter, the repair chime and the terrain stamps
 * all hang off it. They wait here and are handed over on the next frame rather than being
 * dropped on the floor the way a plain store mutation would be.
 */
export class PendingRoundEvents {
  private pending: WorldEvent[] = [];

  push(events: readonly WorldEvent[]): void {
    this.pending.push(...events);
  }

  /** Everything queued since the last frame, exactly once. */
  drain(): readonly WorldEvent[] {
    if (this.pending.length === 0) {
      return NO_EVENTS;
    }

    const drained = this.pending;

    this.pending = [];

    return drained;
  }
}
