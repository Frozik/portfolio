import { assert } from '@frozik/utils/assert/assert';
import { assertNever } from '@frozik/utils/assert/assertNever';

import type { ICandle, ICandleColumns, IPoint, IPointColumns, TBatch } from './shape';

export type TAxisColumn = BigInt64Array | Float64Array;

export interface IPointData {
  readonly shape: 'point';
  readonly length: number;
  readonly x: TAxisColumn;
  readonly value: Float64Array;
}

export interface ICandleData {
  readonly shape: 'candle';
  readonly length: number;
  readonly x: TAxisColumn;
  readonly open: Float64Array;
  readonly min: Float64Array;
  readonly max: Float64Array;
  readonly close: Float64Array;
}

/** A batch as the library keeps it: always columns, whatever the source sent (§4.2). */
export type TColumns = IPointData | ICandleData;

export function columnsOf<TX>(batch: TBatch<TX>): TColumns {
  switch (batch.shape) {
    case 'point':
      return isObjects(batch.points) ? pointColumns(batch.points) : ownPointColumns(batch.points);
    case 'candle':
      return isObjects(batch.candles)
        ? candleColumns(batch.candles)
        : ownCandleColumns(batch.candles);
    default:
      return assertNever(batch);
  }
}

function isObjects<TElement>(
  elements: readonly TElement[] | object
): elements is readonly TElement[] {
  return Array.isArray(elements);
}

/**
 * The positions of a column in the coordinate of the axis: a column only ever
 * holds the type its batch was given in, so the view is read back the same way.
 */
export function positionsOf<TX>(column: TAxisColumn): ArrayLike<TX> {
  return column as unknown as ArrayLike<TX>;
}

/** Columns as a batch again: what a source answers with after its columns were worked on. */
export function batchOfColumns<TX>(columns: TColumns): TBatch<TX> {
  return columns.shape === 'point'
    ? { shape: 'point', points: { x: positionsOf<TX>(columns.x), value: columns.value } }
    : {
        shape: 'candle',
        candles: {
          x: positionsOf<TX>(columns.x),
          open: columns.open,
          min: columns.min,
          max: columns.max,
          close: columns.close,
        },
      };
}

export function axisColumnOf<TX>(positions: ArrayLike<TX>): TAxisColumn {
  return axisColumn(positions);
}

function axisColumn<TX>(positions: ArrayLike<TX>): TAxisColumn {
  if (positions instanceof BigInt64Array || positions instanceof Float64Array) {
    return positions;
  }
  const { length } = positions;
  const isTime = length > 0 && typeof positions[0] === 'bigint';
  const column = isTime ? new BigInt64Array(length) : new Float64Array(length);
  for (let index = 0; index < length; index += 1) {
    const position = positions[index];
    if (column instanceof BigInt64Array) {
      assert(typeof position === 'bigint', 'every position of a time axis is a bigint');
      column[index] = position;
    } else {
      assert(typeof position === 'number', 'every position of a numeric axis is a number');
      column[index] = position;
    }
  }
  return column;
}

function ownPointColumns<TX>(columns: IPointColumns<TX>): IPointData {
  return {
    shape: 'point',
    length: columns.x.length,
    x: axisColumn(columns.x),
    value: columns.value,
  };
}

function ownCandleColumns<TX>(columns: ICandleColumns<TX>): ICandleData {
  return {
    shape: 'candle',
    length: columns.x.length,
    x: axisColumn(columns.x),
    open: columns.open,
    min: columns.min,
    max: columns.max,
    close: columns.close,
  };
}

function pointColumns<TX>(points: readonly IPoint<TX>[]): IPointData {
  const value = new Float64Array(points.length);
  points.forEach((point, index) => {
    value[index] = point.value;
  });
  return {
    shape: 'point',
    length: points.length,
    x: axisColumn(points.map(point => point.x)),
    value,
  };
}

function candleColumns<TX>(candles: readonly ICandle<TX>[]): ICandleData {
  const { length } = candles;
  const open = new Float64Array(length);
  const min = new Float64Array(length);
  const max = new Float64Array(length);
  const close = new Float64Array(length);
  candles.forEach((candle, index) => {
    open[index] = candle.open;
    min[index] = candle.min;
    max[index] = candle.max;
    close[index] = candle.close;
  });
  return {
    shape: 'candle',
    length,
    x: axisColumn(candles.map(candle => candle.x)),
    open,
    min,
    max,
    close,
  };
}
