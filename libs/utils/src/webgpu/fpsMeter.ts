import { MS_PER_SECOND } from '../date/constants';

/** Minimum rolling window used to compute a stable FPS average. */
const DEFAULT_MIN_WINDOW_MS = 1000;
/** How often the FPS value is recalculated and reported. */
const DEFAULT_UPDATE_INTERVAL_MS = 250;
/** Window = max(minWindow, current frame interval × this) so slow targets still average. */
const FRAME_INTERVAL_WINDOW_FACTOR = 3;

export interface FpsMeterOptions {
  /** Called at most once per `updateIntervalMs` with the rolling FPS. */
  readonly onUpdate: (fps: number) => void;
  readonly minWindowMs?: number;
  readonly updateIntervalMs?: number;
}

/**
 * Rolling-window FPS meter shared by the WebGPU render loops. Feed it a
 * timestamp per rendered frame via {@link tick}; it trims samples older than
 * the window and invokes `onUpdate` at most every `updateIntervalMs`.
 *
 * Decoupled from the loop itself so a multi-chart renderer (timeseries) and
 * the single-canvas loop (`startRenderLoop`) share one implementation.
 */
export class FpsMeter {
  private readonly onUpdate: (fps: number) => void;
  private readonly minWindowMs: number;
  private readonly updateIntervalMs: number;
  private readonly frameTimes: number[] = [];
  private lastUpdate = 0;

  constructor(options: FpsMeterOptions) {
    this.onUpdate = options.onUpdate;
    this.minWindowMs = options.minWindowMs ?? DEFAULT_MIN_WINDOW_MS;
    this.updateIntervalMs = options.updateIntervalMs ?? DEFAULT_UPDATE_INTERVAL_MS;
  }

  /**
   * Record a rendered frame at `now`. `frameIntervalMs` is the loop's current
   * target interval — it widens the averaging window for low-FPS targets.
   */
  tick(now: number, frameIntervalMs: number): void {
    this.frameTimes.push(now);
    this.report(now, frameIntervalMs);
  }

  /**
   * Recompute and report without recording a frame. Call on skipped frames
   * (render-on-demand) so the displayed FPS decays toward 0 while idle.
   */
  report(now: number, frameIntervalMs: number): void {
    if (now - this.lastUpdate < this.updateIntervalMs) {
      return;
    }
    this.lastUpdate = now;

    const windowMs = Math.max(this.minWindowMs, frameIntervalMs * FRAME_INTERVAL_WINDOW_FACTOR);
    const cutoff = now - windowMs;
    while (this.frameTimes.length > 0 && this.frameTimes[0] < cutoff) {
      this.frameTimes.shift();
    }

    const elapsed =
      this.frameTimes.length > 1
        ? this.frameTimes[this.frameTimes.length - 1] - this.frameTimes[0]
        : 0;
    const fps =
      elapsed > 0 ? Math.round(((this.frameTimes.length - 1) / elapsed) * MS_PER_SECOND) : 0;
    this.onUpdate(fps);
  }
}
