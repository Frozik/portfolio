import { isNil } from 'lodash-es';

import type { ChartDataError } from '../../core/series/data-error';
import { isAbsent, isTransient } from '../../core/series/data-error';
import type { IInterval } from './interval';
import { intersection, intersects, TIME_MAX, TIME_MIN } from './interval';

const EVERYTHING: IInterval = { start: TIME_MIN, end: TIME_MAX };

export interface IRetryPolicy {
  /** The pause before the first retry, milliseconds; doubled with every failure in a row. */
  readonly delayMs: number;
  readonly maxDelayMs: number;
}

export interface IChannelFailure {
  readonly interval: IInterval;
  readonly error: ChartDataError;
}

interface IFailure extends IChannelFailure {
  /** When the interval is asked for again; never, unless retries are on and the failure is transient. */
  readonly retryAt: number | undefined;
  /** The pause has passed and the interval is being asked for again: still shown as failed, no longer in the way. */
  isRetrying: boolean;
}

/**
 * The requests of one channel that failed. A failure stays shown until the
 * interval is read; one that will be retried stops being in the way of a new
 * request once its pause has passed, and is forgotten altogether when the
 * view leaves it — retrying what nobody looks at is a waste (§4.6).
 */
export class FailureLog {
  private failures: readonly IFailure[] = [];
  private inRow = 0;

  constructor(
    private readonly retry: IRetryPolicy | undefined,
    private readonly now: () => number
  ) {}

  /** The data does not exist at this shape and scale: nothing is asked for any more. */
  get isAbsent(): boolean {
    return this.failures.some(failure => isAbsent(failure.error.code));
  }

  /** The intervals not to be asked for: failed, and not due for a retry. */
  get blocked(): readonly IInterval[] {
    return this.failures.flatMap(failure => (failure.isRetrying ? [] : [failure.interval]));
  }

  record(interval: IInterval, error: ChartDataError): IChannelFailure {
    const retries = !isNil(this.retry) && isTransient(error.code);
    const failure: IFailure = {
      interval: isAbsent(error.code) ? EVERYTHING : interval,
      error,
      retryAt: isNil(this.retry) || !retries ? undefined : this.now() + this.pauseOf(this.retry),
      isRetrying: false,
    };
    this.inRow += 1;
    this.failures = [...this.withoutRetried(interval), failure];
    return failure;
  }

  /** Once a frame: what is due is let through to be asked again, what will be retried but left `wanted` is forgotten. */
  advance(wanted: IInterval): void {
    const now = this.now();
    this.failures = this.failures.filter(
      failure => isNil(failure.retryAt) || intersects(failure.interval, wanted)
    );
    for (const failure of this.failures) {
      if (!isNil(failure.retryAt) && failure.retryAt <= now) {
        failure.isRetrying = true;
      }
    }
  }

  /** The source is heard from again: whatever waits for its pause is asked for now, and the pauses start over. */
  retryNow(): void {
    this.inRow = 0;
    for (const failure of this.failures) {
      if (!isNil(failure.retryAt)) {
        failure.isRetrying = true;
      }
    }
  }

  /** Whether asking for `interval` is a retry of something shown as failed: such a request is not shown as loading. */
  isRetryOf(interval: IInterval): boolean {
    return this.failures.some(
      failure => failure.isRetrying && intersects(failure.interval, interval)
    );
  }

  /** The interval was read: the failures being retried inside it are over, and the others need not wait — the source answers. */
  settle(interval: IInterval): void {
    this.failures = this.withoutRetried(interval);
    this.retryNow();
  }

  /** Forgets the failures in `interval`, whatever their code: a manual retry. */
  forget(interval: IInterval): void {
    this.inRow = 0;
    this.failures = this.failures.filter(failure => !intersects(failure.interval, interval));
  }

  shownIn(wanted: IInterval): readonly IChannelFailure[] {
    return this.failures.flatMap(failure => {
      const interval = intersection(failure.interval, wanted);
      return isNil(interval) ? [] : [{ interval, error: failure.error }];
    });
  }

  private withoutRetried(interval: IInterval): readonly IFailure[] {
    return this.failures.filter(
      failure => !(failure.isRetrying && intersects(failure.interval, interval))
    );
  }

  private pauseOf(retry: IRetryPolicy): number {
    return Math.min(retry.maxDelayMs, retry.delayMs * 2 ** this.inRow);
  }
}
