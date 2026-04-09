import type { MonoTypeOperatorFunction } from 'rxjs';
import { ReplaySubject, share, timer } from 'rxjs';
import type { Milliseconds } from '../date/types';

export function shareReplayWithDelayedReset<T>(
  delay: Milliseconds,
  replay = 1
): MonoTypeOperatorFunction<T> {
  return share<T>({
    connector: () => new ReplaySubject(replay),
    resetOnError: true,
    resetOnComplete: false,
    resetOnRefCountZero: () => timer(delay),
  });
}
