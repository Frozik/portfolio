import { nowEpochMs } from '@frozik/utils/date/now';
import { isNil } from 'lodash-es';

import { MAX_INTERPOLATED_SNAPSHOTS, QUANTIZER_LATE_ARRIVAL_GRACE_MS } from './constants';
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
  readonly lateArrivalGraceMs?: number;
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
 * Aligns raw orderbook snapshots onto 1-second buckets keyed by the
 * exchange's event time. A bucket closes by event-time watermark: the first
 * snapshot stamped at or beyond the bucket's end closes it, so an update
 * that reaches us a few hundred milliseconds after its second has ended on
 * the wall clock still lands where it belongs. Only when the stream goes
 * silent does the wall-clock fallback (`lateArrivalGraceMs` past the bucket
 * end) close the bucket, repeating the last snapshot with
 * `isInterpolated: true` up to `maxInterpolatedSnapshots` and emitting empty
 * snapshots after that so the chart keeps advancing through a gap.
 *
 * The scheduler and clock are injected so tests drive time deterministically.
 */
export class SnapshotQuantizer {
  private readonly buffer = new TimestampedEventBuffer<IBufferedSnapshot>();
  private readonly onEmit: (snapshot: IQuantizedSnapshot) => void;
  private readonly now: () => number;
  private readonly scheduler: IQuantizerScheduler;
  private readonly maxInterpolatedSnapshots: number;
  private readonly lateArrivalGraceMs: number;

  private started = false;
  private currentSecMs: UnixTimeMs = 0 as UnixTimeMs;
  private lastEmittedSnapshot: IOrderbookSnapshot | undefined = undefined;
  private interpolationCount = 0;
  private timerHandle: unknown = undefined;
  private disposed = false;

  constructor(params: ISnapshotQuantizerParams) {
    this.onEmit = params.onEmit;
    this.now = params.now ?? nowEpochMs;
    this.scheduler = params.scheduler ?? DEFAULT_SCHEDULER;
    this.maxInterpolatedSnapshots = params.maxInterpolatedSnapshots ?? MAX_INTERPOLATED_SNAPSHOTS;
    this.lateArrivalGraceMs = params.lateArrivalGraceMs ?? QUANTIZER_LATE_ARRIVAL_GRACE_MS;
  }

  push(snapshot: IOrderbookSnapshot): void {
    if (this.disposed) {
      return;
    }
    this.buffer.enqueue({ timestampMs: snapshot.eventTimeMs, snapshot });
    if (!this.started) {
      this.started = true;
      this.currentSecMs = bucketStart(snapshot.eventTimeMs);
      this.scheduleFallback();
      return;
    }
    while (snapshot.eventTimeMs >= this.currentBucketEndMs) {
      this.closeCurrentBucket();
    }
    this.scheduleFallback();
  }

  dispose(): void {
    this.disposed = true;
    this.scheduler.clearTimeout(this.timerHandle);
    this.timerHandle = undefined;
    this.buffer.clear();
    this.lastEmittedSnapshot = undefined;
    this.interpolationCount = 0;
    this.started = false;
  }

  private get currentBucketEndMs(): number {
    return this.currentSecMs + BUCKET_DURATION_MS;
  }

  /** Wall-clock fallback: closes every bucket whose grace period has expired. */
  private readonly onFallbackTimer = (): void => {
    if (this.disposed) {
      return;
    }
    this.closeCurrentBucket();
    while (this.now() >= this.currentBucketEndMs + this.lateArrivalGraceMs) {
      this.closeCurrentBucket();
    }
    this.scheduleFallback();
  };

  private closeCurrentBucket(): void {
    const drained = this.buffer.drain(this.currentSecMs, this.currentBucketEndMs as UnixTimeMs);
    const latest = drained.at(-1)?.snapshot;

    if (!isNil(latest)) {
      this.emit(latest.bids, latest.asks, false);
      this.lastEmittedSnapshot = latest;
      this.interpolationCount = 0;
    } else if (!isNil(this.lastEmittedSnapshot)) {
      if (this.interpolationCount < this.maxInterpolatedSnapshots) {
        this.emit(this.lastEmittedSnapshot.bids, this.lastEmittedSnapshot.asks, true);
        this.interpolationCount += 1;
      } else {
        this.emit(EMPTY_LEVELS, EMPTY_LEVELS, true);
      }
    }

    this.currentSecMs = this.currentBucketEndMs as UnixTimeMs;
  }

  private emit(
    bids: ReadonlyArray<readonly [number, number]>,
    asks: ReadonlyArray<readonly [number, number]>,
    isInterpolated: boolean
  ): void {
    this.onEmit({ eventTimeMs: this.currentSecMs, bids, asks, isInterpolated });
  }

  private scheduleFallback(): void {
    this.scheduler.clearTimeout(this.timerHandle);
    const fireAtMs = this.currentBucketEndMs + this.lateArrivalGraceMs;
    const delayMs = Math.max(0, fireAtMs - this.now());
    this.timerHandle = this.scheduler.setTimeout(this.onFallbackTimer, delayMs);
  }
}

function bucketStart(timestampMs: UnixTimeMs): UnixTimeMs {
  return (Math.floor(timestampMs / BUCKET_DURATION_MS) * BUCKET_DURATION_MS) as UnixTimeMs;
}
