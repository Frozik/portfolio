import { MS_PER_SECOND } from '../date';

/** Debounce duration before an FPS level is automatically removed. */
const FPS_DEBOUNCE_MS = 500;

/**
 * Frame-rate controller that tracks active FPS levels and computes
 * the target frame interval.
 *
 * FPS levels are numeric values where higher = faster.
 * Each raised level auto-expires after {@link debounceMs} unless re-raised.
 * Call {@link tick} every frame to expire stale levels.
 */
export class FpsController {
  private readonly activeLevels = new Map<number, number>();
  private readonly fallbackFps: number;
  private readonly debounceMs: number;

  constructor(fallbackFps: number, debounceMs: number = FPS_DEBOUNCE_MS) {
    this.fallbackFps = fallbackFps;
    this.debounceMs = debounceMs;
  }

  raise(level: number): void {
    this.activeLevels.set(level, performance.now() + this.debounceMs);
  }

  /** Must be called every frame to expire stale levels. */
  tick(): void {
    const now = performance.now();
    for (const [level, expiresAt] of this.activeLevels) {
      if (now >= expiresAt) {
        this.activeLevels.delete(level);
      }
    }
  }

  getFrameIntervalMs(): number {
    return MS_PER_SECOND / this.getCurrentFps();
  }

  getCurrentFps(): number {
    if (this.activeLevels.size === 0) {
      return this.fallbackFps;
    }

    let maxFps = 0;
    for (const level of this.activeLevels.keys()) {
      if (level > maxFps) {
        maxFps = level;
      }
    }
    return maxFps;
  }

  dispose(): void {
    this.activeLevels.clear();
  }
}
