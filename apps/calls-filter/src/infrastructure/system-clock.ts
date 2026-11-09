import { Temporal } from 'temporal-polyfill';

import type { IClock } from '../contexts/policy/domain/ports/clock';

export const SYSTEM_CLOCK: IClock = {
  now: () => Temporal.Now.instant(),
  localNow: () => Temporal.Now.plainDateTimeISO(),
  timeZone: () => Temporal.Now.timeZoneId(),
};
