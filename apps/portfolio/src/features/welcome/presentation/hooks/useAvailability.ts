import { useEffect, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import type { IAvailability } from '../../domain/availability';
import { resolveAvailability } from '../../domain/availability';
import { AWAKE_WINDOW, MY_TIMEZONE, STATUS_CHECK_INTERVAL_MS } from '../availability-constants';

export type { IAvailability, TAvailabilityStatus } from '../../domain/availability';

function resolveNow(): IAvailability {
  return resolveAvailability(Temporal.Now.zonedDateTimeISO(MY_TIMEZONE), AWAKE_WINDOW);
}

export function useAvailability(): IAvailability {
  const [availability, setAvailability] = useState(resolveNow);

  useEffect(() => {
    const intervalId = setInterval(() => setAvailability(resolveNow()), STATUS_CHECK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []);

  return availability;
}
