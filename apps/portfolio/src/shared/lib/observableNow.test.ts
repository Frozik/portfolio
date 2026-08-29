import { autorun } from 'mobx';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observableNow } from './observableNow';

const INTERVAL_MS = 1_000;

describe('observableNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current epoch milliseconds', () => {
    const before = Date.now();
    const result = observableNow(INTERVAL_MS);
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(Date.now());
  });

  it('re-triggers an observing derivation on every interval tick', () => {
    let runCount = 0;
    const dispose = autorun(() => {
      observableNow(INTERVAL_MS);
      runCount += 1;
    });
    expect(runCount).toBe(1);

    vi.advanceTimersByTime(INTERVAL_MS * 3);
    expect(runCount).toBe(4);

    dispose();
  });

  it('stops ticking once the last observer is disposed', () => {
    let runCount = 0;
    const dispose = autorun(() => {
      observableNow(INTERVAL_MS);
      runCount += 1;
    });
    dispose();

    vi.advanceTimersByTime(INTERVAL_MS * 5);
    expect(runCount).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resumes ticking when the same interval is observed again', () => {
    const firstDispose = autorun(() => {
      observableNow(INTERVAL_MS);
    });
    firstDispose();

    let runCount = 0;
    const secondDispose = autorun(() => {
      observableNow(INTERVAL_MS);
      runCount += 1;
    });
    vi.advanceTimersByTime(INTERVAL_MS * 2);
    expect(runCount).toBe(3);

    secondDispose();
  });

  it('shares one timer between observers of the same interval', () => {
    let firstRunCount = 0;
    let secondRunCount = 0;
    const disposeFirst = autorun(() => {
      observableNow(INTERVAL_MS);
      firstRunCount += 1;
    });
    const disposeSecond = autorun(() => {
      observableNow(INTERVAL_MS);
      secondRunCount += 1;
    });
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(INTERVAL_MS);
    expect(firstRunCount).toBe(2);
    expect(secondRunCount).toBe(2);

    disposeFirst();
    vi.advanceTimersByTime(INTERVAL_MS);
    expect(firstRunCount).toBe(2);
    expect(secondRunCount).toBe(3);

    disposeSecond();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps independent timers for different intervals', () => {
    const otherIntervalMs = INTERVAL_MS * 2;
    let fastRunCount = 0;
    let slowRunCount = 0;
    const disposeFast = autorun(() => {
      observableNow(INTERVAL_MS);
      fastRunCount += 1;
    });
    const disposeSlow = autorun(() => {
      observableNow(otherIntervalMs);
      slowRunCount += 1;
    });

    vi.advanceTimersByTime(INTERVAL_MS);
    expect(fastRunCount).toBe(2);
    expect(slowRunCount).toBe(1);

    vi.advanceTimersByTime(INTERVAL_MS);
    expect(fastRunCount).toBe(3);
    expect(slowRunCount).toBe(2);

    disposeFast();
    disposeSlow();
  });
});
