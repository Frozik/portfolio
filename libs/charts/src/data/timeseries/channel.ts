import { isNil } from 'lodash-es';

import type { TColumns } from '../../core/series/columns';
import { columnsOf } from '../../core/series/columns';
import { ChartDataError, isAbsent, isTransient, toDataError } from '../../core/series/data-error';
import type { TAggregateTime, TRun } from '../../core/series/point-run';
import type { ICandle, IPoint, TBatch, TShape } from '../../core/series/shape';
import { PersistedSegments } from './cache/persisted-segments';
import type { IPersistentCache } from './cache/persistent-cache';
import { emptyColumns } from './column-buffer';
import type { IChannelFailure, IRetryPolicy } from './failure-log';
import { FailureLog } from './failure-log';
import type { IFetchPlan } from './fetch-plan';
import { boundsOf, coveredBy, planFetches } from './fetch-plan';
import { subscribeGuarded } from './guarded-subscription';
import type { IInterval } from './interval';
import { intersection, intersects, TIME_MAX, TIME_MIN } from './interval';
import { PendingElement } from './pending-element';
import { SegmentStore } from './segment-store';
import type { ITimeseriesSource } from './source';
import { timesOf } from './time-columns';
import type { TTimeScale } from './time-scale';

const EVERYTHING: IInterval = { start: TIME_MIN, end: TIME_MAX };

interface IRequest {
  readonly plan: IFetchPlan;
  readonly controller: AbortController;
}

interface ILiveEpoch {
  readonly since: bigint;
  /** Time of the last element the subscription delivered. */
  last: bigint | undefined;
}

export interface IChannelOptions {
  readonly source: ITimeseriesSource;
  readonly shape: TShape;
  readonly scale: TTimeScale;
  readonly nextId: () => number;
  readonly maxConcurrent: number;
  readonly retry: IRetryPolicy | undefined;
  /** Milliseconds on a clock that only runs forward. */
  readonly now: () => number;
  /** Where what is read is kept between sessions, and the name it is kept under; none, and nothing is kept. */
  readonly persistent: { readonly cache: IPersistentCache; readonly key: string } | undefined;
  readonly aggregateTime: TAggregateTime;
  onChanged(interval: IInterval): void;
  onFailed(failure: IChannelFailure): void;
}

/**
 * One series at one shape and scale: what is known of it, the subscription
 * that feeds its live edge, and the requests filling the holes in between (§4.4).
 */
export class Channel {
  readonly store: SegmentStore;
  private readonly pending: PendingElement;
  private readonly requests = new Set<IRequest>();
  private readonly failures: FailureLog;
  private unsubscribe: VoidFunction | undefined;
  private live: ILiveEpoch | undefined;
  /**
   * What is wrong with the live edge, shown as a failure from the last moment
   * delivered on. Final: the subscription is closed, and stays so until
   * retried. Otherwise the source is reconnecting, and the mark goes when it is back.
   */
  private liveTrouble: (IChannelFailure & { readonly isFinal: boolean }) | undefined;
  private readonly persisted: PersistedSegments | undefined;

  constructor(private readonly options: IChannelOptions) {
    this.store = new SegmentStore({
      shape: options.shape,
      step: Number(options.scale),
      aggregateTime: options.aggregateTime,
      nextId: options.nextId,
    });
    this.failures = new FailureLog(options.retry, options.now);
    this.pending = new PendingElement({
      shape: options.shape,
      step: Number(options.scale),
      aggregateTime: options.aggregateTime,
      runId: options.nextId(),
    });
    const { persistent } = options;
    this.persisted = isNil(persistent)
      ? undefined
      : new PersistedSegments({
          cache: persistent.cache,
          key: `${persistent.key}|${options.shape}|${options.scale}`,
          store: this.store,
          onRestored: options.onChanged,
        });
  }

  /** The subscription is open and has not said where the live edge is: nothing is fetched until it does. */
  private get isWaitingForLive(): boolean {
    return !isNil(this.unsubscribe) && isNil(this.live);
  }

  get extent(): Partial<{ start: bigint; end: bigint }> {
    return {
      start: this.store.historyStart,
      end: this.pending.run?.x[0] ?? this.store.lastTime,
    };
  }

  open(): void {
    if (!isNil(this.unsubscribe) || this.liveTrouble?.isFinal === true || this.failures.isAbsent) {
      return;
    }
    const { source, scale, shape } = this.options;
    this.unsubscribe = subscribeGuarded(source, {
      scale,
      shape,
      onStart: since => this.onStart(since),
      onBatch: batch => this.onBatch(batch),
      onPending: pending => this.onPending(pending),
      onError: error => this.onLiveError(error),
    });
  }

  /** Stops listening and asking; what is known stays, closed at the last moment it is known whole. */
  close(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.closeLive();
    this.abort(() => true);
    this.persisted?.cancelReads();
    this.onPending(undefined);
  }

  /** Asks for what is wanted and not known, not on its way and not failed. */
  fill(wanted: IInterval, softLimit: number): void {
    this.failures.advance(wanted);
    if (this.isWaitingForLive) {
      return;
    }
    this.abort(request => !intersects(request.plan.reserved, wanted));
    const requested = [...this.requests].map(request => request.plan.reserved);
    this.persisted?.restore(wanted, requested);
    const busy = [...requested, ...this.failures.blocked, ...(this.persisted?.reading ?? [])];
    for (const plan of planFetches(wanted, this.store.covered, busy)) {
      if (this.requests.size >= this.options.maxConcurrent) {
        return;
      }
      this.request(plan, softLimit);
    }
  }

  runsIn(interval: IInterval): readonly TRun<bigint>[] {
    const runs = this.store.runsIn(interval);
    return isNil(this.pending.run) ? runs : [...runs, this.pending.run];
  }

  loadingIn(wanted: IInterval): readonly IInterval[] {
    if (this.isWaitingForLive) {
      return isNil(this.liveTrouble) ? [wanted] : [];
    }
    // A retry is not shown as loading: its range stays marked as failed until it is read.
    const asked = [...this.requests].flatMap(({ plan }) =>
      this.failures.isRetryOf(plan.hole) ? [] : [plan.reserved]
    );
    return [...asked, ...(this.persisted?.reading ?? [])].flatMap(
      interval => intersection(interval, wanted) ?? []
    );
  }

  /** Frees memory: what lies outside `keep` is forgotten, and looked for in the persistent cache again when wanted. */
  forget(keep: IInterval | undefined): void {
    if (isNil(keep)) {
      this.store.clear();
      this.persisted?.forgetChecked();
    } else if (this.store.trim(keep)) {
      this.persisted?.forgetChecked();
    }
  }

  /** The failures inside `wanted`; trouble with the live edge is told wherever the view is. */
  failedIn(wanted: IInterval): readonly IChannelFailure[] {
    const failed = this.failures.shownIn(wanted);
    if (isNil(this.liveTrouble)) {
      return failed;
    }
    const { interval, error } = this.liveTrouble;
    return [...failed, { interval: intersection(interval, wanted) ?? interval, error }];
  }

  /** Forgets the failures in `interval`, whatever their code, and lets the live edge be asked for again. */
  retry(interval: IInterval): void {
    this.failures.forget(interval);
    this.liveTrouble = undefined;
  }

  private request(plan: IFetchPlan, softLimit: number): void {
    const { source, scale, shape } = this.options;
    const request: IRequest = { plan, controller: new AbortController() };
    this.requests.add(request);
    source
      .fetch({
        ...boundsOf(plan),
        scale,
        shape,
        direction: plan.direction,
        softLimit,
        signal: request.controller.signal,
      })
      .then(
        batch => {
          if (this.requests.delete(request)) {
            this.onAnswer(plan, batch, softLimit);
          }
        },
        (error: unknown) => {
          if (this.requests.delete(request)) {
            this.fail(plan.hole, toDataError(error));
          }
        }
      );
  }

  private onAnswer(plan: IFetchPlan, batch: TBatch, softLimit: number): void {
    const columns = this.columnsOfAnswer(batch);
    if (isNil(columns)) {
      this.fail(
        plan.hole,
        new ChartDataError('INTERNAL', `the source answered with ${batch.shape}s`)
      );
      return;
    }
    const covered = coveredBy(plan, columns, softLimit);
    const times = timesOf(columns);
    if (
      columns.length > 0 &&
      (times[0] < covered.start || times[columns.length - 1] > covered.end)
    ) {
      this.fail(plan.hole, new ChartDataError('INTERNAL', 'the source answered outside the range'));
      return;
    }
    this.store.cover(covered, columns);
    this.failures.settle(covered);
    // Without a live edge "known" may reach into a future that has not happened: not worth keeping.
    if (!isNil(this.live)) {
      this.persisted?.keep(covered, columns);
    }
    this.options.onChanged(covered);
  }

  private columnsOfAnswer(batch: TBatch): TColumns | undefined {
    return batch.shape === this.options.shape ? columnsOf(batch) : undefined;
  }

  private fail(interval: IInterval, error: ChartDataError): void {
    if (error.code === 'CANCELLED') {
      return;
    }
    const failure = this.failures.record(interval, error);
    if (isAbsent(error.code)) {
      this.close();
    }
    this.options.onFailed(failure);
  }

  private abort(when: (request: IRequest) => boolean): void {
    for (const request of this.requests) {
      if (when(request)) {
        this.requests.delete(request);
        request.controller.abort();
      }
    }
  }

  /** History up to `since` comes by request, everything later through the subscription: no gap, no duplicate. */
  private onStart(since: bigint): void {
    this.abort(() => true);
    this.persisted?.cancelReads();
    this.closeLive();
    this.store.truncateAfter(since);
    this.store.cover({ start: since + 1n, end: TIME_MAX }, emptyColumns(this.options.shape));
    this.live = { since, last: undefined };
    this.liveTrouble = undefined;
    this.failures.retryNow();
    this.options.onChanged({ start: since + 1n, end: TIME_MAX });
  }

  /**
   * The live segment ends where it is known whole. The last time delivered may
   * have had more elements coming, so it is given up and asked for again.
   */
  private closeLive(): void {
    if (isNil(this.live)) {
      return;
    }
    const { since, last } = this.live;
    const end = isNil(last) ? since : last - 1n;
    this.store.truncateAfter(end);
    this.live = undefined;
    // What the subscription delivered is kept once, when the live segment closes.
    // Memory may have been freed since: only the part still held is known whole.
    const held = this.store.covered.find(interval => interval.start <= end && interval.end >= end);
    if (!isNil(held) && end > since) {
      const delivered = { start: held.start > since ? held.start : since + 1n, end };
      this.persisted?.keep(delivered, this.store.columnsIn(delivered));
    }
  }

  private onBatch(batch: TBatch): void {
    const columns = this.columnsOfAnswer(batch);
    if (isNil(columns)) {
      this.onLiveError(new ChartDataError('INTERNAL', `the source sent ${batch.shape}s`));
      return;
    }
    if (isNil(this.live) || columns.length === 0) {
      return;
    }
    const times = timesOf(columns);
    this.store.appendLive(columns);
    this.live.last = times[columns.length - 1];
    this.liveTrouble = undefined;
    this.options.onChanged({ start: times[0], end: this.live.last });
  }

  private onPending(element: IPoint | ICandle | undefined): void {
    if (this.pending.set(element)) {
      this.options.onChanged(EVERYTHING);
    }
  }

  /** A transient error closes nothing: the source reconnects by itself. Any other ends the live edge (§4.4). */
  private onLiveError(thrown: unknown): void {
    const error = toDataError(thrown);
    if (error.code === 'CANCELLED') {
      return;
    }
    if (isAbsent(error.code)) {
      this.close();
      this.fail(EVERYTHING, error);
      return;
    }
    const isFinal = !isTransient(error.code);
    if (!isFinal && !isNil(this.liveTrouble)) {
      return;
    }
    const from = this.live?.last ?? this.live?.since ?? TIME_MIN;
    this.liveTrouble = { interval: { start: from, end: TIME_MAX }, error, isFinal };
    if (isFinal) {
      this.close();
    }
    this.options.onFailed(this.liveTrouble);
  }
}
