import { Temporal } from '@js-temporal/polyfill';
import { useEffect, useState } from 'react';

import { MY_TIMEZONE } from '../../constants';

const DEFAULT_TICK_MS = 1000;

function readCurrentTime(): string {
  const now = Temporal.Now.zonedDateTimeISO(MY_TIMEZONE);
  return now.toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function useLiveClock(tickMs: number = DEFAULT_TICK_MS): string {
  const [time, setTime] = useState(readCurrentTime);

  useEffect(() => {
    const intervalId = setInterval(() => setTime(readCurrentTime()), tickMs);
    return () => clearInterval(intervalId);
  }, [tickMs]);

  return time;
}
