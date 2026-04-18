import { beforeEach, describe, expect, test } from 'vitest';

import type { ITaskManagerScheduler } from './task-manager';
import { TaskManager } from './task-manager';

class FakeRafScheduler implements ITaskManagerScheduler {
  private nowMs = 0;
  private nextHandle = 1;
  private pendingCallback: { handle: number; callback: () => void } | undefined = undefined;

  now(): number {
    return this.nowMs;
  }

  setNow(ms: number): void {
    this.nowMs = ms;
  }

  requestAnimationFrame(callback: () => void): number {
    const handle = this.nextHandle++;
    this.pendingCallback = { handle, callback };
    return handle;
  }

  cancelAnimationFrame(handle: number): void {
    if (this.pendingCallback?.handle === handle) {
      this.pendingCallback = undefined;
    }
  }

  /** Fire the single pending RAF callback, if any. */
  fireFrame(): boolean {
    const pending = this.pendingCallback;
    if (pending === undefined) {
      return false;
    }
    this.pendingCallback = undefined;
    pending.callback();
    return true;
  }

  /** Advance time by `deltaMs` and fire every pending RAF until the loop self-parks. */
  advance(deltaMs: number, framesPerStep = 1): void {
    const stepMs = deltaMs / Math.max(1, framesPerStep);
    for (let step = 0; step < framesPerStep; step++) {
      this.nowMs += stepMs;
      if (!this.fireFrame()) {
        return;
      }
    }
  }

  get hasPending(): boolean {
    return this.pendingCallback !== undefined;
  }
}

describe('TaskManager', () => {
  let scheduler: FakeRafScheduler;
  let manager: TaskManager;

  beforeEach(() => {
    scheduler = new FakeRafScheduler();
    // `idleFps: 1000` makes the shared FPS gate effectively transparent
    // (1 ms interval) so each `scheduler.fireFrame()` processes tasks.
    // Tests of the FPS-gate itself pass a lower value explicitly.
    manager = new TaskManager({ scheduler, idleFps: 1000 });
  });

  test('starts the RAF loop on first subscription and stops when empty', () => {
    expect(scheduler.hasPending).toBe(false);

    const unsubscribe = manager.subscribe(() => undefined, { minIntervalMs: 0 });
    expect(scheduler.hasPending).toBe(true);

    unsubscribe();
    expect(scheduler.hasPending).toBe(false);
  });

  test('invokes a task on every frame when minIntervalMs is 0', () => {
    let calls = 0;
    manager.subscribe(
      () => {
        calls++;
      },
      { minIntervalMs: 0 }
    );

    scheduler.advance(16);
    scheduler.advance(16);
    scheduler.advance(16);

    expect(calls).toBe(3);
  });

  test('respects minIntervalMs — task fires only after enough wall time', () => {
    let calls = 0;
    manager.subscribe(
      () => {
        calls++;
      },
      { minIntervalMs: 100 }
    );

    // First frame: task hasn't run yet → due at t=0 → fires once
    scheduler.advance(16);
    expect(calls).toBe(1);

    // Next frame at t=32 → not yet 100ms since last run → skip
    scheduler.advance(16);
    expect(calls).toBe(1);

    // Jump to t>100 since last run → fires
    scheduler.advance(100);
    expect(calls).toBe(2);
  });

  test('multiple tasks run at independent cadences', () => {
    const fast: number[] = [];
    const slow: number[] = [];

    manager.subscribe(() => fast.push(scheduler.now()), { minIntervalMs: 0 });
    manager.subscribe(() => slow.push(scheduler.now()), { minIntervalMs: 100 });

    for (let step = 0; step < 10; step++) {
      scheduler.advance(16);
    }

    expect(fast.length).toBe(10);
    expect(slow.length).toBeGreaterThanOrEqual(1);
    expect(slow.length).toBeLessThan(fast.length);
  });

  test('unsubscribing mid-tick stops further callbacks', () => {
    let callsA = 0;
    let callsB = 0;

    const unsubA = manager.subscribe(
      () => {
        callsA++;
        unsubA();
      },
      { minIntervalMs: 0 }
    );

    manager.subscribe(
      () => {
        callsB++;
      },
      { minIntervalMs: 0 }
    );

    scheduler.advance(16);
    scheduler.advance(16);
    scheduler.advance(16);

    expect(callsA).toBe(1);
    expect(callsB).toBe(3);
  });

  test('idle FPS gate throttles task processing when nobody raised', () => {
    const idleManager = new TaskManager({ scheduler, idleFps: 10 });
    let calls = 0;
    idleManager.subscribe(
      () => {
        calls++;
      },
      { minIntervalMs: 0 }
    );

    // First RAF at t=16: gate passes thanks to initial NEGATIVE_INFINITY,
    // task fires once.
    scheduler.advance(16);
    expect(calls).toBe(1);

    // Next RAF at t=32: 32-16 = 16 < 100 (idle interval) → skip.
    scheduler.advance(16);
    expect(calls).toBe(1);

    // Jump past the interval → task fires.
    scheduler.advance(100);
    expect(calls).toBe(2);

    idleManager.dispose();
  });

  test('raise() lifts the gate so tasks run at higher cadence', () => {
    const gatedManager = new TaskManager({ scheduler, idleFps: 10 });
    let calls = 0;
    gatedManager.subscribe(
      () => {
        calls++;
      },
      { minIntervalMs: 0 }
    );

    gatedManager.raise(60); // 60 fps → 16.67ms interval
    scheduler.advance(17);
    scheduler.advance(17);
    expect(calls).toBeGreaterThanOrEqual(2);

    gatedManager.dispose();
  });

  test('dispose stops the loop and ignores further subscribes', () => {
    let calls = 0;
    manager.subscribe(
      () => {
        calls++;
      },
      { minIntervalMs: 0 }
    );

    scheduler.advance(16);
    expect(calls).toBe(1);

    manager.dispose();
    expect(scheduler.hasPending).toBe(false);

    manager.subscribe(
      () => {
        calls++;
      },
      { minIntervalMs: 0 }
    );
    scheduler.advance(16);

    expect(calls).toBe(1);
  });
});
