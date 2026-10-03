import type { ITickAxis, ITickRange } from '../core/frame/ticks';
import type { IAxisDomain } from '../core/viewport/axis-domain';
import { numberDomain } from '../core/viewport/number-domain';

/** An axis of ticks laid out evenly over its pixels, with nothing cut out: what a generator test needs. */
export function linearTickAxis<TPosition>(
  domain: IAxisDomain<TPosition>,
  range: ITickRange<TPosition>,
  lengthPx: number
): ITickAxis<TPosition> {
  const span = domain.diff(range.end, range.start);
  return {
    domain,
    range,
    lengthPx,
    pixelOf: position => (domain.diff(position, range.start) / span) * lengthPx,
    shownAt: position => position,
  };
}

/** A logarithmic value scale as an axis of ticks. */
export function logTickAxis(range: ITickRange<number>, lengthPx: number): ITickAxis<number> {
  const span = Math.log(range.end / range.start);
  return {
    domain: numberDomain,
    range,
    lengthPx,
    pixelOf: position => (Math.log(position / range.start) / span) * lengthPx,
    shownAt: position => position,
  };
}
