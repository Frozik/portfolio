import { useEffect, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import {
  AWAKE_END_HOUR,
  AWAKE_START_HOUR,
  MY_TIMEZONE,
  STATUS_CHECK_INTERVAL_MS,
} from '../../constants';

export type TAvailabilityStatus = 'online' | 'away' | 'weekend';

export interface IAvailability {
  readonly status: TAvailabilityStatus;
  readonly isAwake: boolean;
}

const SATURDAY = 6;
const SUNDAY = 7;

function resolveAvailability(): IAvailability {
  const now = Temporal.Now.zonedDateTimeISO(MY_TIMEZONE);
  const isAwake = now.hour >= AWAKE_START_HOUR && now.hour < AWAKE_END_HOUR;
  const isWeekend = now.dayOfWeek === SATURDAY || now.dayOfWeek === SUNDAY;

  if (isWeekend) {
    return { status: 'weekend', isAwake };
  }

  return { status: isAwake ? 'online' : 'away', isAwake };
}

export function useAvailability(): IAvailability {
  const [availability, setAvailability] = useState(resolveAvailability);

  useEffect(() => {
    const intervalId = setInterval(
      () => setAvailability(resolveAvailability()),
      STATUS_CHECK_INTERVAL_MS
    );
    return () => clearInterval(intervalId);
  }, []);

  return availability;
}
