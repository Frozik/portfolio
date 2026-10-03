import { isNil } from 'lodash-es';

/** The operations the kernel needs from an X coordinate, whatever its type (§3.8). */
export interface IAxisDomain<TX> {
  compare(first: TX, second: TX): number;
  /** `minuend − subtrahend` in axis units, as a plain number. */
  diff(minuend: TX, subtrahend: TX): number;
  add(position: TX, delta: number): TX;
  /** The origin of the axis: where virtual and world coordinates meet when stretches are taken out (sessions §2). */
  readonly zero: TX;
  /** `minuend − subtrahend` in the coordinate's own type: exact, for lengths that add up over decades. */
  minus(minuend: TX, subtrahend: TX): TX;
  plus(position: TX, offset: TX): TX;
  /** The longest range a chart over this axis may show, in axis units; none, and any length may be shown. */
  readonly maxSpan?: number;
}

/** A range no longer than the axis allows: one that is too long is shortened round its middle. */
export function withinMaxSpan<TX>(domain: IAxisDomain<TX>, range: IAxisRange<TX>): IAxisRange<TX> {
  const { maxSpan } = domain;
  const span = domain.diff(range.end, range.start);
  if (isNil(maxSpan) || span <= maxSpan) {
    return range;
  }
  const start = domain.add(range.start, (span - maxSpan) / 2);
  return { start, end: domain.add(start, maxSpan) };
}

export interface IAxisRange<TX> {
  readonly start: TX;
  readonly end: TX;
}

export interface IValueRange {
  readonly min: number;
  readonly max: number;
}

export function spanOf<TX>(domain: IAxisDomain<TX>, range: IAxisRange<TX>): number {
  return domain.diff(range.end, range.start);
}

export function shiftRange<TX>(
  domain: IAxisDomain<TX>,
  range: IAxisRange<TX>,
  delta: number
): IAxisRange<TX> {
  return { start: domain.add(range.start, delta), end: domain.add(range.end, delta) };
}

export function isSameRange<TX>(
  domain: IAxisDomain<TX>,
  first: IAxisRange<TX>,
  second: IAxisRange<TX>
): boolean {
  return (
    domain.compare(first.start, second.start) === 0 && domain.compare(first.end, second.end) === 0
  );
}

export function minOf<TX>(domain: IAxisDomain<TX>, first: TX, second: TX): TX {
  return domain.compare(first, second) <= 0 ? first : second;
}

export function maxOf<TX>(domain: IAxisDomain<TX>, first: TX, second: TX): TX {
  return domain.compare(first, second) >= 0 ? first : second;
}
