import { Temporal } from 'temporal-polyfill';

import type { ISessionClock } from '../session/domain/ports/session-clock';

interface ITimer {
  next: number;
  readonly every: number | null;
  readonly callback: () => void;
}

/** A wall clock under the test's hand: time moves only when the test says so. */
export function createFakeSessionClock() {
  let now = 1_700_000_000_000;
  let timers: ITimer[] = [];
  const schedule = (timer: ITimer): (() => void) => {
    timers.push(timer);
    return () => {
      timers = timers.filter(candidate => candidate !== timer);
    };
  };

  const clock: ISessionClock = {
    now: () => now,
    today: () =>
      Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO('UTC').toPlainDate(),
    every: (ms, callback) => schedule({ next: now + ms, every: ms, callback }),
    after: (ms, callback) => schedule({ next: now + ms, every: null, callback }),
  };

  return {
    clock,
    /** Timers fire on schedule while the machine is awake. */
    advance(ms: number): void {
      const until = now + ms;
      for (;;) {
        const due = timers.filter(timer => timer.next <= until).sort((a, b) => a.next - b.next)[0];
        if (due === undefined) {
          break;
        }
        now = due.next;
        if (due.every === null) {
          timers = timers.filter(timer => timer !== due);
        } else {
          due.next += due.every;
        }
        due.callback();
      }
      now = until;
    },
    /** A sleeping machine fires no timers; the clock still moves, and every overdue timer fires on waking. */
    sleep(ms: number): void {
      now += ms;
      for (const timer of timers) {
        timer.next = Math.max(timer.next, now);
      }
    },
    pendingTimers: () => timers.length,
  };
}
