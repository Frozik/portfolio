import { FpsController } from '@frozik/utils/webgpu/fpsController';

import { FPS_IDLE } from './constants';

export interface ITaskManagerTaskOptions {
  /**
   * Minimum wall-clock interval between two invocations of the task,
   * in milliseconds. `0` (or a value below the RAF frame time) means
   * "run every TaskManager tick" — the task cadence is then gated by
   * the shared FPS interval.
   */
  readonly minIntervalMs: number;
}

export interface ITaskManagerScheduler {
  requestAnimationFrame(callback: () => void): number;
  cancelAnimationFrame(handle: number): void;
  now(): number;
}

export interface ITaskManagerParams {
  readonly scheduler?: ITaskManagerScheduler;
  /** Fallback FPS when no level is raised. Defaults to the idle level. */
  readonly idleFps?: number;
}

const DEFAULT_SCHEDULER: ITaskManagerScheduler = {
  requestAnimationFrame: callback => globalThis.requestAnimationFrame(callback),
  cancelAnimationFrame: handle => globalThis.cancelAnimationFrame(handle),
  now: () => performance.now(),
};

interface IScheduledTask {
  readonly callback: () => void;
  readonly minIntervalMs: number;
  nextDueMs: number;
}

/**
 * Shared RAF-driven task scheduler for controllers + owner of the
 * feature-level {@link FpsController}.
 *
 * Architecture rules:
 * - There is exactly one RAF loop per feature; every periodic piece
 *   of work — renderer, viewport lerp, mid-price driver — subscribes
 *   as a task here instead of running its own loop.
 * - The {@link FpsController} gates the scheduler as a whole: each
 *   iteration waits until the current frame interval has elapsed
 *   before processing tasks. When no consumer calls `raise(...)`, the
 *   loop naturally drops to the idle FPS level (default 10 Hz),
 *   cutting CPU when the chart has nothing to animate.
 * - Callers request higher FPS via {@link raise}. Levels auto-decay
 *   after `FPS_DEBOUNCE_MS` unless re-raised.
 * - The design is pull-based: no cross-controller reactivity. Each
 *   tick, a task reads whatever state it needs from peers and
 *   processes it. Staleness within a tick is accepted; data
 *   converges over the next few ticks.
 *
 * `requestAnimationFrame`, `cancelAnimationFrame`, and `now()` are
 * injectable so tests drive frames deterministically.
 */
export class TaskManager {
  private readonly tasks: IScheduledTask[] = [];
  private readonly scheduler: ITaskManagerScheduler;
  readonly fpsController: FpsController;

  private rafHandle: number | undefined;
  private lastProcessedMs = Number.NEGATIVE_INFINITY;
  private disposed = false;

  constructor(params: ITaskManagerParams = {}) {
    this.scheduler = params.scheduler ?? DEFAULT_SCHEDULER;
    this.fpsController = new FpsController(params.idleFps ?? FPS_IDLE);
  }

  subscribe(callback: () => void, options: ITaskManagerTaskOptions): () => void {
    if (this.disposed) {
      return () => undefined;
    }
    const task: IScheduledTask = {
      callback,
      minIntervalMs: Math.max(0, options.minIntervalMs),
      nextDueMs: this.scheduler.now(),
    };
    this.tasks.push(task);
    this.ensureRunning();
    return () => this.unsubscribe(task);
  }

  /**
   * Raise the shared FPS level so the loop wakes more frequently.
   * Levels auto-decay; callers re-raise while they still want high
   * FPS (pan drag, zoom animation, follow drift).
   */
  raise(level: number): void {
    this.fpsController.raise(level);
  }

  dispose(): void {
    this.disposed = true;
    this.tasks.length = 0;
    this.fpsController.dispose();
    this.stop();
  }

  private unsubscribe(task: IScheduledTask): void {
    const index = this.tasks.indexOf(task);
    if (index >= 0) {
      this.tasks.splice(index, 1);
    }
    if (this.tasks.length === 0) {
      this.stop();
    }
  }

  private ensureRunning(): void {
    if (this.rafHandle !== undefined || this.disposed) {
      return;
    }
    this.rafHandle = this.scheduler.requestAnimationFrame(this.tick);
  }

  private stop(): void {
    if (this.rafHandle !== undefined) {
      this.scheduler.cancelAnimationFrame(this.rafHandle);
      this.rafHandle = undefined;
    }
  }

  private readonly tick = (): void => {
    this.rafHandle = undefined;
    if (this.disposed) {
      return;
    }
    this.fpsController.tick();
    const nowMs = this.scheduler.now();
    const frameIntervalMs = this.fpsController.getFrameIntervalMs();

    if (nowMs - this.lastProcessedMs >= frameIntervalMs) {
      this.lastProcessedMs = nowMs;
      // Iterate a snapshot so a callback can unsubscribe itself (or
      // other tasks) mid-tick without breaking iteration — the check
      // below skips tasks that have been removed from the live list.
      const snapshot = this.tasks.slice();
      for (const task of snapshot) {
        if (!this.tasks.includes(task)) {
          continue;
        }
        if (nowMs >= task.nextDueMs) {
          task.nextDueMs = nowMs + task.minIntervalMs;
          task.callback();
        }
      }
    }

    if (this.tasks.length > 0 && !this.disposed) {
      this.rafHandle = this.scheduler.requestAnimationFrame(this.tick);
    }
  };
}
