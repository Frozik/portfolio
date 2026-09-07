import { useCallback, useSyncExternalStore } from 'react';
import { Temporal } from 'temporal-polyfill';

import { MY_TIMEZONE } from '../availability-constants';

const DEFAULT_TICK_MS = 1000;

function readCurrentTime(): string {
  const now = Temporal.Now.zonedDateTimeISO(MY_TIMEZONE);
  return now.toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** What the prerendered page and the hydrating render agree on: no time yet. */
function readServerTime(): undefined {
  return undefined;
}

/**
 * The author's local time, `undefined` until hydration: the build-time markup
 * cannot know the visitor's moment, so the first client render matches it
 * and the clock fills in right after.
 */
export function useLiveClock(tickMs: number = DEFAULT_TICK_MS): string | undefined {
  const subscribe = useCallback(
    (onTick: VoidFunction) => {
      const intervalId = setInterval(onTick, tickMs);
      return () => clearInterval(intervalId);
    },
    [tickMs]
  );

  return useSyncExternalStore(subscribe, readCurrentTime, readServerTime);
}
