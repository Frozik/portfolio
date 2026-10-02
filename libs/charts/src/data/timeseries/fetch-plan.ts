import { isNil } from 'lodash-es';

import type { TColumns } from '../../core/series/columns';
import type { IInterval } from './interval';
import { subtract, TIME_MIN } from './interval';
import type { TFetchDirection } from './source';
import { timesOf } from './time-columns';

export interface IFetchPlan {
  /** The part of what is wanted that the request is for. */
  readonly hole: IInterval;
  /** Everything the answer may turn out to cover: no other request may ask inside it. */
  readonly reserved: IInterval;
  readonly direction: TFetchDirection;
}

/**
 * One request per hole in what is wanted, latest first. A hole that touches
 * what is known on its left grows from that edge forward; any other is read
 * backward from its right edge, as far as the limit lets it — which is how
 * the beginning of history is found (§4.4).
 */
export function planFetches(
  wanted: IInterval,
  covered: readonly IInterval[],
  busy: readonly IInterval[]
): readonly IFetchPlan[] {
  const taken = [...covered, ...busy];
  return subtract(wanted, taken)
    .map((hole): IFetchPlan => {
      if (covered.some(interval => interval.end + 1n === hole.start)) {
        return { hole, reserved: hole, direction: 'forward' };
      }
      let leftEdge: bigint | undefined;
      for (const interval of taken) {
        if (interval.end < hole.start && (isNil(leftEdge) || interval.end > leftEdge)) {
          leftEdge = interval.end;
        }
      }
      return {
        hole,
        reserved: { start: isNil(leftEdge) ? TIME_MIN : leftEdge + 1n, end: hole.end },
        direction: 'backward',
      };
    })
    .reverse();
}

export interface IFetchBounds {
  readonly from: bigint | undefined;
  readonly to: bigint;
  readonly includeFrom: false;
  readonly includeTo: true;
}

/** The bounds as a source takes them: after the time before the interval, up to its end. */
export function boundsOf({ reserved }: IFetchPlan): IFetchBounds {
  return {
    from: reserved.start === TIME_MIN ? undefined : reserved.start - 1n,
    to: reserved.end,
    includeFrom: false,
    includeTo: true,
  };
}

/**
 * What an answer covers. Fewer elements than the limit means the whole
 * interval was read; otherwise it was cut at the far end, at the time of the
 * element the limit stopped on — a time is never split between two answers.
 */
export function coveredBy(plan: IFetchPlan, columns: TColumns, softLimit: number): IInterval {
  const { reserved, direction } = plan;
  if (columns.length < softLimit) {
    return reserved;
  }
  const times = timesOf(columns);
  return direction === 'forward'
    ? { start: reserved.start, end: times[columns.length - 1] }
    : { start: times[0], end: reserved.end };
}
