import { assert } from '@frozik/utils/assert/assert';
import { assertNever } from '@frozik/utils/assert/assertNever';

import type { TColumns } from '../../core/series/columns';
import type { TShape } from '../../core/series/shape';
import { timesOf } from './time-columns';

const INITIAL_CAPACITY = 256;

/** The value columns of a shape, in the one order everything that stores them agrees on. */
export function valueColumnsOf(columns: TColumns): readonly Float64Array[] {
  switch (columns.shape) {
    case 'point':
      return [columns.value];
    case 'candle':
      return [columns.open, columns.min, columns.max, columns.close];
    default:
      return assertNever(columns);
  }
}

/** The elements of the columns whose times lie in `start`…`end`, both included. */
export function sliceColumns(columns: TColumns, start: bigint, end: bigint): TColumns {
  const times = timesOf(columns);
  const from = times.findIndex(time => time >= start);
  if (from === -1) {
    return emptyColumns(columns.shape);
  }
  const after = times.findIndex(time => time > end);
  const slice = new ColumnBuffer(columns.shape);
  slice.append(columns, from, after === -1 ? columns.length : after);
  return slice.view();
}

export function emptyColumns(shape: TShape): TColumns {
  return new ColumnBuffer(shape).view();
}

/** Columns put back together from a time column and the value columns of `valueColumnsOf`. */
export function columnsFrom(
  shape: TShape,
  x: BigInt64Array,
  values: readonly Float64Array[]
): TColumns {
  const { length } = x;
  const [first, second, third, fourth] = values;
  switch (shape) {
    case 'point':
      return { shape, length, x, value: first };
    case 'candle':
      return { shape, length, x, open: first, min: second, max: third, close: fourth };
    default:
      return assertNever(shape);
  }
}

const VALUE_COLUMNS: Readonly<Record<TShape, number>> = { point: 1, candle: 4 };

/** Columns of one shape over time that grow at the end without being copied on every append. */
export class ColumnBuffer {
  private x = new BigInt64Array(INITIAL_CAPACITY);
  private values: Float64Array[];
  private count = 0;

  constructor(readonly shape: TShape) {
    this.values = Array.from(
      { length: VALUE_COLUMNS[shape] },
      () => new Float64Array(INITIAL_CAPACITY)
    );
  }

  get length(): number {
    return this.count;
  }

  timeAt(index: number): bigint {
    return this.x[index];
  }

  /** Appends elements `from`…`to` of the columns. */
  append(columns: TColumns, from = 0, to = columns.length): void {
    assert(columns.shape === this.shape, `${this.shape} columns cannot take ${columns.shape} data`);
    const added = to - from;
    if (added <= 0) {
      return;
    }
    this.reserve(this.count + added);
    this.x.set(timesOf(columns).subarray(from, to), this.count);
    valueColumnsOf(columns).forEach((column, index) => {
      this.values[index].set(column.subarray(from, to), this.count);
    });
    this.count += added;
  }

  /** Drops everything from `length` on. */
  truncate(length: number): void {
    this.count = Math.min(this.count, length);
  }

  /** The elements as columns: views of the buffer, valid until it grows. */
  view(): TColumns {
    const length = this.count;
    return columnsFrom(
      this.shape,
      this.x.subarray(0, length),
      this.values.map(column => column.subarray(0, length))
    );
  }

  private reserve(needed: number): void {
    if (needed <= this.x.length) {
      return;
    }
    let capacity = this.x.length;
    while (capacity < needed) {
      capacity *= 2;
    }
    const x = new BigInt64Array(capacity);
    x.set(this.x.subarray(0, this.count));
    this.x = x;
    this.values = this.values.map(column => {
      const grown = new Float64Array(capacity);
      grown.set(column.subarray(0, this.count));
      return grown;
    });
  }
}
