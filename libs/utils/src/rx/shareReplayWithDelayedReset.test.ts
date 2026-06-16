import type { Observable } from 'rxjs';
import { defer, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Milliseconds } from '../date/types';
import { shareReplayWithDelayedReset } from './shareReplayWithDelayedReset';

const RESET_DELAY = 1_000 as Milliseconds;

describe('shareReplayWithDelayedReset', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Builds a hot upstream `Subject` plus a cold `Observable` that counts how
   * many times it is subscribed (= how many times the shared pipe connects to
   * the source). `share` multicasts a single subscription across borrowers.
   */
  function createCountingSource(): {
    connectCount: () => number;
    upstream: Subject<number>;
    source$: Observable<number>;
  } {
    let connectCount = 0;
    const upstream = new Subject<number>();
    const source$ = defer(() => {
      connectCount += 1;
      return upstream;
    });

    return { connectCount: () => connectCount, upstream, source$ };
  }

  it('shares ONE upstream subscription across concurrent subscribers', () => {
    const { connectCount, upstream, source$ } = createCountingSource();
    const shared$ = source$.pipe(shareReplayWithDelayedReset(RESET_DELAY));

    const firstValues: number[] = [];
    const secondValues: number[] = [];
    shared$.subscribe(value => firstValues.push(value));
    shared$.subscribe(value => secondValues.push(value));

    expect(connectCount()).toBe(1);

    upstream.next(42);

    expect(firstValues).toEqual([42]);
    expect(secondValues).toEqual([42]);
  });

  it('replays the latest value to a late subscriber', () => {
    const { connectCount, upstream, source$ } = createCountingSource();
    const shared$ = source$.pipe(shareReplayWithDelayedReset(RESET_DELAY));

    const firstValues: number[] = [];
    shared$.subscribe(value => firstValues.push(value));
    upstream.next(7);

    const lateValues: number[] = [];
    shared$.subscribe(value => lateValues.push(value));

    // Same upstream — no reconnect — and the buffered value is replayed.
    expect(connectCount()).toBe(1);
    expect(lateValues).toEqual([7]);
  });

  it('does NOT tear down the upstream immediately when the last subscriber leaves', () => {
    const { connectCount, upstream, source$ } = createCountingSource();
    const shared$ = source$.pipe(shareReplayWithDelayedReset(RESET_DELAY));

    const subscription = shared$.subscribe();
    upstream.next(1);
    expect(connectCount()).toBe(1);

    subscription.unsubscribe();

    // Within the delay window a fresh subscribe reuses the live upstream and
    // gets the replayed value — proving the upstream was not reset.
    vi.advanceTimersByTime(RESET_DELAY - 1);
    const lateValues: number[] = [];
    shared$.subscribe(value => lateValues.push(value));

    expect(connectCount()).toBe(1);
    expect(lateValues).toEqual([1]);
  });

  it('cancels the pending reset when a subscriber re-borrows within the delay window', () => {
    const { connectCount, upstream, source$ } = createCountingSource();
    const shared$ = source$.pipe(shareReplayWithDelayedReset(RESET_DELAY));

    const subscription = shared$.subscribe();
    upstream.next(99);
    subscription.unsubscribe();

    // Re-subscribe before the delay elapses to cancel the pending reset...
    vi.advanceTimersByTime(RESET_DELAY / 2);
    const keepAlive = shared$.subscribe();

    // ...then let the original delay window fully elapse. No reset should fire.
    vi.advanceTimersByTime(RESET_DELAY);

    const lateValues: number[] = [];
    shared$.subscribe(value => lateValues.push(value));

    expect(connectCount()).toBe(1);
    expect(lateValues).toEqual([99]);

    keepAlive.unsubscribe();
  });

  it('reconnects the upstream for a fresh subscribe after the delay elapses', () => {
    const { connectCount, upstream, source$ } = createCountingSource();
    const shared$ = source$.pipe(shareReplayWithDelayedReset(RESET_DELAY));

    const subscription = shared$.subscribe();
    upstream.next(5);
    subscription.unsubscribe();

    // Delay fully elapses with no subscribers — upstream is reset.
    vi.advanceTimersByTime(RESET_DELAY);

    const freshValues: number[] = [];
    shared$.subscribe(value => freshValues.push(value));

    // A second connect happened, and the stale replay buffer is gone.
    expect(connectCount()).toBe(2);
    expect(freshValues).toEqual([]);
  });
});
