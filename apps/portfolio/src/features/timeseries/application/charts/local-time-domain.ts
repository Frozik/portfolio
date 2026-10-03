import type { ITimeDomain } from '@frozik/charts/core/viewport/time-domain';
import { timeDomain } from '@frozik/charts/core/viewport/time-domain';
import { Temporal } from 'temporal-polyfill';

/** The axis of time as the visitor's clock tells it: every chart of the demo reads the calendar in the zone of the page. */
export function localTimeDomain(): ITimeDomain {
  return timeDomain({ timeZone: Temporal.Now.timeZoneId() });
}
