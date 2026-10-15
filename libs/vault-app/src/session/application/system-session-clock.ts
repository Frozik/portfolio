import { Temporal } from 'temporal-polyfill';

import type { ISessionClock } from '../domain/ports/session-clock';

/** The system's wall clock and JavaScript timers, the same in a browser and on a phone. */
export const SYSTEM_SESSION_CLOCK: ISessionClock = {
  now: () => Temporal.Now.instant().epochMilliseconds,
  today: () => Temporal.Now.plainDateISO(),
  every: (ms, callback) => {
    const timer = setInterval(callback, ms);
    return () => clearInterval(timer);
  },
  after: (ms, callback) => {
    const timer = setTimeout(callback, ms);
    return () => clearTimeout(timer);
  },
};
