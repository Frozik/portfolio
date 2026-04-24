import { useEffect, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

const MILLIS_PER_SECOND = 1000;

function getPlainDateNow(timeZone: string): Temporal.PlainDate {
  return Temporal.Now.plainDateISO(timeZone);
}

function getMillisUntilMidnight(timeZone: string): number {
  const now = Temporal.Now.zonedDateTimeISO(timeZone);
  const midnight = now
    .toPlainDate()
    .add({ days: 1 })
    .toZonedDateTime({ timeZone, plainTime: new Temporal.PlainTime(0) });

  const nanosUntilMidnight = midnight.epochNanoseconds - now.epochNanoseconds;
  const millisUntilMidnight = Number(nanosUntilMidnight / BigInt(1_000_000));

  return Math.max(millisUntilMidnight, MILLIS_PER_SECOND);
}

/**
 * Returns today's PlainDate in the given time zone.
 * Automatically updates when the date changes (at midnight).
 */
export function useToday(timeZone: string): Temporal.PlainDate {
  const [today, setToday] = useState(() => getPlainDateNow(timeZone));

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;

    const scheduleUpdate = () => {
      timerId = setTimeout(() => {
        setToday(getPlainDateNow(timeZone));
        scheduleUpdate();
      }, getMillisUntilMidnight(timeZone));
    };

    // In case timeZone changed and the date is already different
    setToday(getPlainDateNow(timeZone));
    scheduleUpdate();

    return () => clearTimeout(timerId);
  }, [timeZone]);

  return today;
}
