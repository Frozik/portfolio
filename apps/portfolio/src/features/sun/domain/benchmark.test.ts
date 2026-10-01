import { describe, expect, it } from 'vitest';

import type { Benchmark } from './benchmark';
import {
  advance,
  INITIAL_BENCHMARK,
  MAX_TRIANGLES,
  MIN_TRIANGLES,
  trianglesToDraw,
} from './benchmark';
import { refreshRateOf } from './refresh-rate';

const MS_PER_SECOND = 1000;
const FRAME_LIMIT = 100_000;

interface Device {
  readonly refreshHz: number;
  /** The most triangles it draws inside one refresh of its display. */
  readonly capacity: number;
  /** Frames, by number, that take an extra pause whatever is drawn: the system hiccuping. */
  readonly hitches?: ReadonlyMap<number, number>;
}

/** A vsynced device: a frame takes as many whole refreshes as its triangles need. */
function run(device: Device, until: (benchmark: Benchmark) => boolean): Benchmark {
  const refreshMs = MS_PER_SECOND / device.refreshHz;
  let benchmark = INITIAL_BENCHMARK;
  let nowMs = 0;
  for (let frame = 0; frame < FRAME_LIMIT && !until(benchmark); frame += 1) {
    benchmark = advance(benchmark, nowMs);
    const refreshes = Math.max(1, Math.ceil(trianglesToDraw(benchmark) / device.capacity));
    nowMs += refreshes * refreshMs + (device.hitches?.get(frame) ?? 0);
  }
  return benchmark;
}

const isFinished = (benchmark: Benchmark): boolean => benchmark.phase === 'finished';

function finish(device: Device): Extract<Benchmark, { phase: 'finished' }> {
  const benchmark = run(device, isFinished);
  if (benchmark.phase !== 'finished') {
    throw new Error(`the test did not finish: ${benchmark.phase}`);
  }
  return benchmark;
}

describe('the benchmark', () => {
  it('draws nothing while it reads the display rate, so the rate read is the display’s own', () => {
    expect(trianglesToDraw(INITIAL_BENCHMARK)).toBe(0);
    const searching = run(
      { refreshHz: 60, capacity: 1 },
      benchmark => benchmark.phase !== 'calibrating'
    );

    expect(searching.phase).toBe('searching');
    expect(trianglesToDraw(searching)).toBeGreaterThan(0);
  });

  it('finds the rate of whatever display it runs on', () => {
    for (const refreshHz of [60, 90, 120, 144]) {
      const { refreshIntervalMs } = finish({ refreshHz, capacity: 300_000 });

      expect(refreshRateOf(refreshIntervalMs)).toBe(refreshHz);
    }
  });

  it('finds, within a tenth, the most triangles the device holds at its display’s rate', () => {
    for (const refreshHz of [60, 120]) {
      for (const capacity of [7_000, 180_000, 2_400_000, 31_000_000]) {
        const { holds, isCapped } = finish({ refreshHz, capacity });

        expect(holds).toBeLessThanOrEqual(capacity);
        expect(holds).toBeGreaterThanOrEqual(capacity * 0.9 - MIN_TRIANGLES);
        expect(isCapped).toBe(false);
      }
    }
  });

  it('keeps drawing what it found once it is done', () => {
    const done = finish({ refreshHz: 60, capacity: 180_000 });

    expect(trianglesToDraw(done)).toBe(done.holds);
    expect(advance(done, 1e9)).toBe(done);
  });

  it('forgives a lone hitch — a count is rejected only when it drops frames twice running', () => {
    const steady = finish({ refreshHz: 60, capacity: 2_400_000 });
    const hitches = new Map([
      [150, 400],
      [420, 5000],
    ]);

    const hiccuping = finish({ refreshHz: 60, capacity: 2_400_000, hitches });

    expect(hiccuping.holds).toBe(steady.holds);
  });

  it('says nought holds on a device that drops frames at the smallest count, and still draws something', () => {
    const done = finish({ refreshHz: 60, capacity: 100 });

    expect(done.holds).toBe(0);
    expect(trianglesToDraw(done)).toBe(MIN_TRIANGLES);
  });

  it('stops at the cap on a device it cannot slow down, and says the result is a lower bound', () => {
    const done = finish({ refreshHz: 60, capacity: Number.MAX_SAFE_INTEGER });

    expect(done.holds).toBe(MAX_TRIANGLES);
    expect(done.isCapped).toBe(true);
  });
});
