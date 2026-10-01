import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import { refreshIntervalOf } from './refresh-rate';

/** Frames right after the page starts are not the display's cadence yet. */
const CALIBRATION_WARMUP_MS = 200;
const CALIBRATION_MS = 1000;
/** After the load changes, the frames still in the pipeline belong to the old one. */
const SETTLE_MS = 300;
const WINDOW_MS = 1000;
/** Frames a window may lose and still count as holding the rate: two stray hitches and the clock's jitter. */
const LOST_FRAMES_TOLERANCE = 2.5;
/** A count is rejected only when it drops frames twice running: one hitch is the system's, not the load's. */
const DROPS_TO_REJECT = 2;
const FIRST_TRIANGLES = 50_000;
const GROWTH_FACTOR = 2;
/** The search stops once the count that holds and the one that does not are this close, as a share of the first. */
const PRECISION_SHARE = 0.1;
/** Below this a count is not worth telling apart; it is also what is drawn when nothing holds. */
export const MIN_TRIANGLES = 1000;
/** The search stops here: a card that holds this much is reported as holding at least this much. */
export const MAX_TRIANGLES = 100_000_000;

interface Calibrating {
  readonly phase: 'calibrating';
  readonly startedAt: number | undefined;
  readonly lastFrameAt: number | undefined;
  readonly intervalsMs: readonly number[];
}

interface MeasureWindow {
  /** The first frame drawn with the current count. */
  readonly changedAt: number | undefined;
  /** The frame the count of frames starts from, once the load has settled. */
  readonly measuringFrom: number | undefined;
  readonly frames: number;
}

interface Searching {
  readonly phase: 'searching';
  readonly refreshIntervalMs: number;
  /** The largest count seen to hold the display's rate; nought until one has. */
  readonly holds: number;
  /** The smallest count seen to drop frames; none while the count is still being doubled. */
  readonly drops: number | undefined;
  /** The count being drawn and measured now. */
  readonly triangles: number;
  readonly dropsInARow: number;
  readonly window: MeasureWindow;
}

interface Finished {
  readonly phase: 'finished';
  readonly refreshIntervalMs: number;
  /** The most triangles that held the display's rate. */
  readonly holds: number;
  /** The search ran into `MAX_TRIANGLES` with the rate still held. */
  readonly isCapped: boolean;
}

/**
 * The test of how many triangles the device draws without leaving the
 * display's own frame rate. It first finds that rate — 60, 120, whatever the
 * screen runs at — from an idle page, then doubles the count while a second
 * of frames keeps the rate, and once a count drops frames closes in between
 * the last that held and the first that did not.
 */
export type Benchmark = Calibrating | Searching | Finished;

export const INITIAL_BENCHMARK: Benchmark = {
  phase: 'calibrating',
  startedAt: undefined,
  lastFrameAt: undefined,
  intervalsMs: [],
};

const FRESH_WINDOW: MeasureWindow = { changedAt: undefined, measuringFrom: undefined, frames: 0 };

/** How many triangles this frame draws; none while the display's rate is being read off an idle page. */
export function trianglesToDraw(benchmark: Benchmark): number {
  switch (benchmark.phase) {
    case 'calibrating':
      return 0;
    case 'searching':
      return benchmark.triangles;
    case 'finished':
      return Math.max(benchmark.holds, MIN_TRIANGLES);
    default:
      return assertNever(benchmark);
  }
}

/** The test after one more animation frame at `nowMs`; the same value when the frame changed nothing. */
export function advance(benchmark: Benchmark, nowMs: number): Benchmark {
  switch (benchmark.phase) {
    case 'calibrating':
      return calibrate(benchmark, nowMs);
    case 'searching':
      return measure(benchmark, nowMs);
    case 'finished':
      return benchmark;
    default:
      return assertNever(benchmark);
  }
}

function calibrate(calibrating: Calibrating, nowMs: number): Benchmark {
  const { startedAt, lastFrameAt } = calibrating;
  if (isNil(startedAt) || isNil(lastFrameAt)) {
    return { ...calibrating, startedAt: nowMs, lastFrameAt: nowMs };
  }
  const sinceStart = nowMs - startedAt;
  if (sinceStart < CALIBRATION_WARMUP_MS) {
    return { ...calibrating, lastFrameAt: nowMs };
  }
  const intervalsMs = [...calibrating.intervalsMs, nowMs - lastFrameAt];
  if (sinceStart < CALIBRATION_WARMUP_MS + CALIBRATION_MS) {
    return { ...calibrating, lastFrameAt: nowMs, intervalsMs };
  }
  const refreshIntervalMs = refreshIntervalOf(intervalsMs);
  return isNil(refreshIntervalMs)
    ? INITIAL_BENCHMARK
    : {
        phase: 'searching',
        refreshIntervalMs,
        holds: 0,
        drops: undefined,
        triangles: FIRST_TRIANGLES,
        dropsInARow: 0,
        window: FRESH_WINDOW,
      };
}

function measure(searching: Searching, nowMs: number): Benchmark {
  const { window, refreshIntervalMs } = searching;
  if (isNil(window.changedAt)) {
    return { ...searching, window: { ...window, changedAt: nowMs } };
  }
  if (nowMs - window.changedAt < SETTLE_MS) {
    return searching;
  }
  if (isNil(window.measuringFrom)) {
    return { ...searching, window: { ...window, measuringFrom: nowMs } };
  }
  const frames = window.frames + 1;
  const elapsedMs = nowMs - window.measuringFrom;
  const lostFrames = elapsedMs / refreshIntervalMs - frames;
  if (lostFrames > LOST_FRAMES_TOLERANCE) {
    return afterDrop(searching);
  }
  if (elapsedMs >= WINDOW_MS) {
    return afterHold(searching);
  }
  return { ...searching, window: { ...window, frames } };
}

function afterDrop(searching: Searching): Benchmark {
  const dropsInARow = searching.dropsInARow + 1;
  if (dropsInARow < DROPS_TO_REJECT) {
    return { ...searching, dropsInARow, window: FRESH_WINDOW };
  }
  return closeIn({ ...searching, drops: searching.triangles });
}

function afterHold(searching: Searching): Benchmark {
  const held: Searching = { ...searching, holds: searching.triangles };
  if (!isNil(held.drops)) {
    return closeIn(held);
  }
  if (held.triangles >= MAX_TRIANGLES) {
    return finished(held, true);
  }
  return next(held, Math.min(held.triangles * GROWTH_FACTOR, MAX_TRIANGLES));
}

function closeIn(searching: Searching): Benchmark {
  const { holds, drops } = searching;
  if (isNil(drops)) {
    return searching;
  }
  const closeEnough = Math.max(MIN_TRIANGLES, holds * PRECISION_SHARE);
  return drops - holds <= closeEnough
    ? finished(searching, false)
    : next(searching, Math.round((holds + drops) / 2));
}

function next(searching: Searching, triangles: number): Searching {
  return { ...searching, triangles, dropsInARow: 0, window: FRESH_WINDOW };
}

function finished(searching: Searching, isCapped: boolean): Finished {
  return {
    phase: 'finished',
    refreshIntervalMs: searching.refreshIntervalMs,
    holds: searching.holds,
    isCapped,
  };
}
