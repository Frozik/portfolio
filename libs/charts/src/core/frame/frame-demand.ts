const MS_PER_SECOND = 1000;
/** The rate a chart asks for while something on it moves. */
export const ACTIVE_FPS = 60;
/** A raised rate holds this long after the last raise. */
const HOLD_MS = 500;

/**
 * How often the chart wants frames. Whoever needs one raises a rate; a raised
 * rate lapses on its own, and with nothing raised the chart idles (§3.6).
 */
export class FrameDemand {
  private readonly expiryByRate = new Map<number, number>();
  private readonly raisedSinceTick = new Set<number>();

  constructor(private readonly idleFps: number) {}

  raise(fps: number): void {
    this.raisedSinceTick.add(fps);
  }

  /** Once a frame: starts the hold of what was raised since the last tick and drops what lapsed. */
  tick(now: number): void {
    for (const fps of this.raisedSinceTick) {
      this.expiryByRate.set(fps, now + HOLD_MS);
    }
    this.raisedSinceTick.clear();
    for (const [fps, expiresAt] of this.expiryByRate) {
      if (now >= expiresAt) {
        this.expiryByRate.delete(fps);
      }
    }
  }

  get fps(): number {
    return Math.max(this.idleFps, ...this.expiryByRate.keys(), ...this.raisedSinceTick);
  }

  get intervalMs(): number {
    return MS_PER_SECOND / this.fps;
  }
}
