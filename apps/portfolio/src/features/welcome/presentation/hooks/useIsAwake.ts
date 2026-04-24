import { useEffect, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import {
  AWAKE_END_HOUR,
  AWAKE_START_HOUR,
  MY_TIMEZONE,
  STATUS_CHECK_INTERVAL_MS,
} from '../../constants';

function checkIsAwake(): boolean {
  const hour = Temporal.Now.zonedDateTimeISO(MY_TIMEZONE).hour;
  return hour >= AWAKE_START_HOUR && hour < AWAKE_END_HOUR;
}

export function useIsAwake(): boolean {
  const [isAwake, setIsAwake] = useState(checkIsAwake);

  useEffect(() => {
    const intervalId = setInterval(() => setIsAwake(checkIsAwake()), STATUS_CHECK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []);

  return isAwake;
}
