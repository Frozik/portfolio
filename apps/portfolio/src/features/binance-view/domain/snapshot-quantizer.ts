import { nowEpochMs } from '@frozik/utils';
import { isNil } from 'lodash-es';

import { MAX_INTERPOLATED_SNAPSHOTS } from './constants';
import { TimestampedEventBuffer } from './timestamped-event-buffer';
import type { IOrderbookSnapshot, IQuantizedSnapshot, UnixTimeMs } from './types';

const BUCKET_DURATION_MS = 1000;

export interface IQuantizerScheduler {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface ISnapshotQuantizerParams {
  readonly onEmit: (snapshot: IQuantizedSnapshot) => void;
  readonly now?: () => number;
  readonly scheduler?: IQuantizerScheduler;
  readonly maxInterpolatedSnapshots?: number;
}

interface IBufferedSnapshot {
  readonly timestampMs: UnixTimeMs;
  readonly snapshot: IOrderbookSnapshot;
}

const DEFAULT_SCHEDULER: IQuantizerScheduler = {
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: handle => {
    if (!isNil(handle)) {
      globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
    }
  },
};

const EMPTY_LEVELS: ReadonlyArray<readonly [number, number]> = [];

/**
 * Aligns raw orderbook snapshots onto fixed 1-second buckets anchored
 * at the first snapshot's second (wall-clock ms truncated), filling
 * empty buckets by repeating the last emitted snapshot with an
 * `isInterpolated: true` flag. After `maxInterpolatedSnapshots`
 * consecutive repeats the quantizer keeps ticking but emits empty
 * snapshots (`bids = asks = []`, `isInterpolated: true`) so downstream
 * visuals keep moving — otherwise the heatmap would freeze during
 * long disconnects instead of showing the gap.
 *
 * Pure — the scheduler and wall clock are injected so tests can drive
 * the timer deterministically. No RxJS, no MobX.
 */
export class SnapshotQuantizer {
  private readonly buffer = new TimestampedEventBuffer<IBufferedSnapshot>();
  private readonly onEmit: (snapshot: IQuantizedSnapshot) => void;
  private readonly now: () => number;
  private readonly scheduler: IQuantizerScheduler;
  private readonly maxInterpolatedSnapshots: number;

  private started = false;
  private currentSecMs: UnixTimeMs = 0 as UnixTimeMs;
  private lastEmittedSnapshot: IOrderbookSnapshot | null = null;
  private interpolationCount = 0;
  private timerHandle: unknown = undefined;
  private disposed = false;

  constructor(params: ISnapshotQuantizerParams) {
    this.onEmit = params.onEmit;
    this.now = params.now ?? nowEpochMs;
    this.scheduler = params.scheduler ?? DEFAULT_SCHEDULER;
    this.maxInterpolatedSnapshots = params.maxInterpolatedSnapshots ?? MAX_INTERPOLATED_SNAPSHOTS;
  }

  push(snapshot: IOrderbookSnapshot): void {
    if (this.disposed) {
      return;
    }
    this.buffer.enqueue({ timestampMs: snapshot.eventTimeMs, snapshot });
    if (!this.started) {
      this.start(snapshot.eventTimeMs);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.scheduler.clearTimeout(this.timerHandle);
    this.timerHandle = undefined;
    this.buffer.clear();
    this.lastEmittedSnapshot = null;
    this.interpolationCount = 0;
    this.started = false;
  }

  private start(firstTimestampMs: UnixTimeMs): void {
    this.started = true;
    this.currentSecMs = (Math.floor(firstTimestampMs / BUCKET_DURATION_MS) *
      BUCKET_DURATION_MS) as UnixTimeMs;
    this.scheduleNextTick();
  }

  private readonly tick = (): void => {
    if (this.disposed) {
      return;
    }
    this.processCurrentSecond();
    this.currentSecMs = (this.currentSecMs + BUCKET_DURATION_MS) as UnixTimeMs;

    // Catch-up loop: if the timer fired late (tab throttled, CPU spike)
    // or we've just gotten a snapshot from several seconds in the past,
    // fast-forward through any buckets whose wall-clock end has already
    // passed so we never fall behind silently.
    while (this.now() >= this.currentSecMs + BUCKET_DURATION_MS) {
      this.processCurrentSecond();
      this.currentSecMs = (this.currentSecMs + BUCKET_DURATION_MS) as UnixTimeMs;
    }

    this.scheduleNextTick();
  };

  private processCurrentSecond(): void {
    const fromMs = this.currentSecMs;
    const toMs = (this.currentSecMs + BUCKET_DURATION_MS) as UnixTimeMs;
    const drained = this.buffer.drain(fromMs, toMs);

    if (drained.length > 0) {
      const latest = drained[drained.length - 1].snapshot;
      this.emit(latest.bids, latest.asks, false);
      this.lastEmittedSnapshot = latest;
      this.interpolationCount = 0;
      return;
    }

    if (this.lastEmittedSnapshot === null) {
      // Haven't seen a real snapshot yet — keep the timer ticking but
      // don't invent bids/asks out of thin air.
      return;
    }

    if (this.interpolationCount < this.maxInterpolatedSnapshots) {
      this.emit(this.lastEmittedSnapshot.bids, this.lastEmittedSnapshot.asks, true);
      this.interpolationCount += 1;
      return;
    }

    // Past the cap — emit an empty snapshot so the chart keeps
    // advancing; downstream treats this as "data stream is silent".
    this.emit(EMPTY_LEVELS, EMPTY_LEVELS, true);
  }

  private emit(
    bids: ReadonlyArray<readonly [number, number]>,
    asks: ReadonlyArray<readonly [number, number]>,
    isInterpolated: boolean
  ): void {
    this.onEmit({
      eventTimeMs: this.currentSecMs,
      bids,
      asks,
      isInterpolated,
    });
  }

  private scheduleNextTick(): void {
    const fireAtMs = this.currentSecMs + BUCKET_DURATION_MS;
    const delayMs = Math.max(0, fireAtMs - this.now());
    this.timerHandle = this.scheduler.setTimeout(this.tick, delayMs);
  }
}
