import { NANOS_PER_DAY } from '@frozik/utils/date/constants';

import type { IAxisDomain } from './axis-domain';

/** Time as nanoseconds from the Unix epoch: too many for a `number`, so a `bigint` (§3.8). */
const DAYS_PER_YEAR = 365.25;
const NANOS_PER_YEAR = DAYS_PER_YEAR * NANOS_PER_DAY;
/**
 * Seconds are kept in 32 bits where a GPU draws them, and their differences
 * are exact only within 68 years; half a century is as far as a chart over
 * time zooms out.
 */
const MAX_SPAN_YEARS = 50;
const DEFAULT_TIME_ZONE = 'UTC';

export interface ITimeDomainOptions {
  /** The zone the chart reads the clock and the calendar in — labels, a schedule; UTC by default. */
  readonly timeZone?: string;
}

/** The axis of time, and the zone everything on it is told in. */
export interface ITimeDomain extends IAxisDomain<bigint> {
  readonly timeZone: string;
}

export function timeDomain(options: ITimeDomainOptions = {}): ITimeDomain {
  return {
    timeZone: options.timeZone ?? DEFAULT_TIME_ZONE,
    maxSpan: MAX_SPAN_YEARS * NANOS_PER_YEAR,
    compare: (first, second) => (first < second ? -1 : first > second ? 1 : 0),
    diff: (minuend, subtrahend) => Number(minuend - subtrahend),
    add: (position, delta) => position + BigInt(Math.round(delta)),
    zero: 0n,
    minus: (minuend, subtrahend) => minuend - subtrahend,
    plus: (position, offset) => position + offset,
  };
}

export function isTimeDomain(domain: IAxisDomain<unknown>): domain is ITimeDomain {
  return 'timeZone' in domain;
}
