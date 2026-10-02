import type { IAxisDomain } from '../../core/viewport/axis-domain';

/** Time as nanoseconds from the Unix epoch: too many for a `number`, so a `bigint` (§3.8). */
const NANOS_PER_YEAR = 365.25 * 86_400 * 1e9;
/**
 * Seconds are kept in 32 bits where a GPU draws them, and their differences
 * are exact only within 68 years; half a century is as far as a chart over
 * time zooms out.
 */
const MAX_SPAN_YEARS = 50;

export const timeDomain: IAxisDomain<bigint> = {
  maxSpan: MAX_SPAN_YEARS * NANOS_PER_YEAR,
  compare: (first, second) => (first < second ? -1 : first > second ? 1 : 0),
  diff: (minuend, subtrahend) => Number(minuend - subtrahend),
  add: (position, delta) => position + BigInt(Math.round(delta)),
};
