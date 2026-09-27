import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import type { TColumnKind } from '../../core/columns/column';
import type { TBivariantCallback } from '../../core/kernel/callback';

export type TComparator<TRow, TValue> = TBivariantCallback<
  [left: TValue, right: TValue, leftRow: TRow, rightRow: TRow],
  number
>;

const NUMERIC_LOCALE_OPTIONS: Intl.CollatorOptions = { numeric: true, sensitivity: 'base' };

function compareTemporal(left: unknown, right: unknown): number | undefined {
  if (left instanceof Temporal.Instant && right instanceof Temporal.Instant) {
    return Temporal.Instant.compare(left, right);
  }
  if (left instanceof Temporal.PlainDate && right instanceof Temporal.PlainDate) {
    return Temporal.PlainDate.compare(left, right);
  }
  if (left instanceof Temporal.PlainDateTime && right instanceof Temporal.PlainDateTime) {
    return Temporal.PlainDateTime.compare(left, right);
  }
  if (left instanceof Temporal.ZonedDateTime && right instanceof Temporal.ZonedDateTime) {
    return Temporal.ZonedDateTime.compare(left, right);
  }
  return undefined;
}

/** Values of one column compared by their kind; ISO strings for dates compare as strings, which orders them correctly. */
export function compareByKind(kind: TColumnKind, left: unknown, right: unknown): number {
  if (left === right) {
    return 0;
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right);
  }
  if (typeof left === 'bigint' && typeof right === 'bigint') {
    return left < right ? -1 : 1;
  }
  const temporal = compareTemporal(left, right);
  if (temporal !== undefined) {
    return temporal;
  }
  if (kind === 'date' || kind === 'datetime') {
    return String(left) < String(right) ? -1 : 1;
  }
  return String(left).localeCompare(String(right), undefined, NUMERIC_LOCALE_OPTIONS);
}

/** Missing values sort last whatever the direction; everything else follows `compare` with the direction applied. */
export function withNullsLast<TRow, TValue>(
  compare: TComparator<TRow, TValue>,
  sign: 1 | -1
): TComparator<TRow, TValue> {
  return (left, right, leftRow, rightRow) => {
    const leftMissing = isNil(left);
    const rightMissing = isNil(right);
    if (leftMissing && rightMissing) {
      return 0;
    }
    if (leftMissing) {
      return 1;
    }
    if (rightMissing) {
      return -1;
    }
    return sign * compare(left, right, leftRow, rightRow);
  };
}
