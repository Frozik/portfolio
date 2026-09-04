import { beforeEach, describe, expect, test } from 'vitest';

import type { IQuantizerScheduler } from './snapshot-quantizer';
import { SnapshotQuantizer } from './snapshot-quantizer';
import type { IOrderbookSnapshot, IQuantizedSnapshot, UnixTimeMs } from './types';

const GRACE_MS = 1500;

interface IFakeTimer {
  readonly fireAtMs: number;
  readonly callback: () => void;
  cancelled: boolean;
}

class FakeClock {
  private nowMs = 0;
  private nextId = 1;
  private readonly timers = new Map<number, IFakeTimer>();

  setNow(ms: number): void {
    this.nowMs = ms;
  }

  now(): number {
    return this.nowMs;
  }

  get scheduler(): IQuantizerScheduler {
    return {
      setTimeout: (callback, delayMs) => {
        const id = this.nextId++;
        this.timers.set(id, { fireAtMs: this.nowMs + delayMs, callback, cancelled: false });
        return id;
      },
      clearTimeout: handle => {
        if (typeof handle !== 'number') {
          return;
        }
        const timer = this.timers.get(handle);
        if (timer !== undefined) {
          timer.cancelled = true;
        }
      },
    };
  }

  /** Advances to `targetMs`, firing pending timers in order; timers scheduled mid-advance are honoured. */
  advanceTo(targetMs: number): void {
    while (true) {
      let nextId: number | undefined;
      let nextFireAt = Number.POSITIVE_INFINITY;
      for (const [id, timer] of this.timers) {
        if (timer.cancelled) {
          continue;
        }
        if (timer.fireAtMs < nextFireAt) {
          nextFireAt = timer.fireAtMs;
          nextId = id;
        }
      }
      if (nextId === undefined || nextFireAt > targetMs) {
        break;
      }
      const timer = this.timers.get(nextId);
      this.timers.delete(nextId);
      this.nowMs = nextFireAt;
      timer?.callback();
    }
    this.nowMs = targetMs;
  }
}

function snapshot(eventTimeMs: number, midPrice = 100, volume = 1): IOrderbookSnapshot {
  return {
    eventTimeMs: eventTimeMs as UnixTimeMs,
    bids: [[midPrice, volume]],
    asks: [[midPrice + 0.5, volume]],
  };
}

describe('SnapshotQuantizer', () => {
  let clock: FakeClock;
  let emitted: IQuantizedSnapshot[];

  beforeEach(() => {
    clock = new FakeClock();
    emitted = [];
  });

  function makeQuantizer(maxInterpolatedSnapshots = 5): SnapshotQuantizer {
    return new SnapshotQuantizer({
      onEmit: snap => emitted.push(snap),
      now: () => clock.now(),
      scheduler: clock.scheduler,
      maxInterpolatedSnapshots,
      lateArrivalGraceMs: GRACE_MS,
    });
  }

  test('a snapshot from the next second closes the previous bucket without waiting for the clock', () => {
    clock.setNow(1543);
    const quantizer = makeQuantizer();
    quantizer.push(snapshot(1543));
    quantizer.push(snapshot(2100, 101));

    expect(emitted).toHaveLength(1);
    expect(emitted[0].eventTimeMs).toBe(1000);
    expect(emitted[0].isInterpolated).toBe(false);
  });

  test('an update arriving after its second has ended on the wall clock still lands in its bucket', () => {
    clock.setNow(1000);
    const quantizer = makeQuantizer();
    quantizer.push(snapshot(1000, 100));

    // The exchange stamped this update inside second 1, but the network delivered it at 2300.
    clock.advanceTo(2300);
    quantizer.push(snapshot(1800, 105));
    clock.advanceTo(2000 + GRACE_MS);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].isInterpolated).toBe(false);
    expect(emitted[0].bids[0][0]).toBe(105);
  });

  test('takes the latest snapshot within the bucket when multiple arrive', () => {
    clock.setNow(1200);
    const quantizer = makeQuantizer();
    quantizer.push(snapshot(1200, 100));
    quantizer.push(snapshot(1500, 101));
    quantizer.push(snapshot(1800, 102));

    clock.advanceTo(2000 + GRACE_MS);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].bids[0][0]).toBe(102);
  });

  test('once the stream goes silent, repeats the last snapshot up to the cap, then emits empty ones', () => {
    clock.setNow(1000);
    const quantizer = makeQuantizer(5);
    quantizer.push(snapshot(1000, 100));

    clock.advanceTo(8000 + GRACE_MS);

    // 1 real + 5 repeat-last-with-data + 1 empty (past cap) = 7
    expect(emitted).toHaveLength(7);
    expect(emitted[0].isInterpolated).toBe(false);
    for (let index = 1; index <= 5; index++) {
      expect(emitted[index].isInterpolated).toBe(true);
      expect(emitted[index].bids[0][0]).toBe(100);
      expect(emitted[index].eventTimeMs).toBe(1000 + index * 1000);
    }

    expect(emitted[6].isInterpolated).toBe(true);
    expect(emitted[6].bids).toEqual([]);
    expect(emitted[6].asks).toEqual([]);
    expect(emitted[6].eventTimeMs).toBe(7000);

    clock.advanceTo(10_000 + GRACE_MS);
    expect(emitted).toHaveLength(9);
    expect(emitted[7].bids).toEqual([]);
    expect(emitted[8].bids).toEqual([]);
  });

  test('interpolation counter resets after a real snapshot arrives', () => {
    clock.setNow(1000);
    const quantizer = makeQuantizer(5);
    quantizer.push(snapshot(1000, 100));

    clock.setNow(4600);
    quantizer.push(snapshot(4500, 200));
    expect(emitted.map(snap => snap.isInterpolated)).toEqual([false, true, true]);

    clock.advanceTo(5000 + GRACE_MS);
    expect(emitted[3].isInterpolated).toBe(false);
    expect(emitted[3].bids[0][0]).toBe(200);

    clock.advanceTo(7000 + GRACE_MS);
    expect(emitted[4].isInterpolated).toBe(true);
    expect(emitted[4].bids[0][0]).toBe(200);
    expect(emitted[5].isInterpolated).toBe(true);
  });

  test('catches up through stale buckets when the first snapshot is backdated', () => {
    clock.setNow(5000);
    const quantizer = makeQuantizer(10);
    quantizer.push(snapshot(1000, 100));
    clock.advanceTo(5000 + GRACE_MS);

    expect(emitted).toHaveLength(4);
    expect(emitted[0].isInterpolated).toBe(false);
    expect(emitted[0].eventTimeMs).toBe(1000);
    for (let index = 1; index <= 3; index++) {
      expect(emitted[index].isInterpolated).toBe(true);
      expect(emitted[index].eventTimeMs).toBe(1000 + index * 1000);
    }
  });

  test('does not emit anything before the first push', () => {
    clock.setNow(1000);
    makeQuantizer();
    clock.advanceTo(10_000);
    expect(emitted).toHaveLength(0);
  });

  test('dispose cancels the pending timer and clears the buffer', () => {
    clock.setNow(1000);
    const quantizer = makeQuantizer();
    quantizer.push(snapshot(1000, 100));
    quantizer.dispose();
    clock.advanceTo(10_000);
    expect(emitted).toHaveLength(0);
  });
});
