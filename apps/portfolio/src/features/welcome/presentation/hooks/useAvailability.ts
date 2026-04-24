import { useEffect, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import {
  AWAKE_END_HOUR,
  AWAKE_START_HOUR,
  MY_TIMEZONE,
  STATUS_CHECK_INTERVAL_MS,
} from '../../constants';

export type TAvailabilityStatus = 'online' | 'away' | 'weekend';

const SATURDAY = 6;
const SUNDAY = 7;

function resolveStatus(): TAvailabilityStatus {
  const now = Temporal.Now.zonedDateTimeISO(MY_TIMEZONE);
  if (now.dayOfWeek === SATURDAY || now.dayOfWeek === SUNDAY) {
    return 'weekend';
  }
  return now.hour >= AWAKE_START_HOUR && now.hour < AWAKE_END_HOUR ? 'online' : 'away';
}

export function useAvailability(): TAvailabilityStatus {
  const [status, setStatus] = useState(resolveStatus);

  useEffect(() => {
    const intervalId = setInterval(() => setStatus(resolveStatus()), STATUS_CHECK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []);

  return status;
}
