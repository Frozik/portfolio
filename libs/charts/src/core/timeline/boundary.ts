import { Temporal } from 'temporal-polyfill';

import type { TBoundary } from './schedule';

export interface IResolvedBoundary {
  readonly at: string;
  readonly timeZone: string;
}

export function resolveBoundary(boundary: TBoundary, defaultZone: string): IResolvedBoundary {
  return typeof boundary === 'string' ? { at: boundary, timeZone: defaultZone } : boundary;
}

/** The moment a once-entry boundary names: a date-time read in its zone. */
export function momentOf(boundary: IResolvedBoundary): bigint {
  return Temporal.PlainDateTime.from(boundary.at).toZonedDateTime(boundary.timeZone)
    .epochNanoseconds;
}

/** The moment a weekly boundary names on a calendar date: its time of day read in its zone. */
export function momentOnDate(boundary: IResolvedBoundary, date: Temporal.PlainDate): bigint {
  return date.toZonedDateTime({
    timeZone: boundary.timeZone,
    plainTime: Temporal.PlainTime.from(boundary.at),
  }).epochNanoseconds;
}
