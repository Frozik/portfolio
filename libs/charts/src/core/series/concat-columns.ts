import { assert } from '@frozik/utils/assert/assert';

import type { ICandleData, IPointData, TAxisColumn, TColumns } from './columns';

interface IColumn<TSelf> {
  readonly length: number;
  set(values: TSelf, offset: number): void;
}

function joined<TPart extends { readonly length: number }, TColumn extends IColumn<TColumn>>(
  parts: readonly TPart[],
  make: (length: number) => TColumn,
  columnOf: (part: TPart) => TColumn
): TColumn {
  const column = make(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    column.set(columnOf(part), offset);
    offset += part.length;
  }
  return column;
}

function joinedAxis(parts: readonly TColumns[]): TAxisColumn {
  const [first] = parts;
  return first.x instanceof BigInt64Array
    ? joined(
        parts,
        length => new BigInt64Array(length),
        part => {
          assert(part.x instanceof BigInt64Array, 'one coordinate for every answer of a series');
          return part.x;
        }
      )
    : joined(
        parts,
        length => new Float64Array(length),
        part => {
          assert(part.x instanceof Float64Array, 'one coordinate for every answer of a series');
          return part.x;
        }
      );
}

function ofShape<TShaped extends TColumns>(
  parts: readonly TColumns[],
  isShaped: (part: TColumns) => part is TShaped
): readonly TShaped[] {
  return parts.map(part => {
    assert(isShaped(part), 'answers of different shapes cannot be joined');
    return part;
  });
}

/** The columns of several answers one after another, in the order given. */
export function concatColumns(parts: readonly TColumns[]): TColumns {
  const [first] = parts;
  assert(first !== undefined, 'nothing to join');
  const values = <TPart extends TColumns>(
    shaped: readonly TPart[],
    columnOf: (part: TPart) => Float64Array
  ): Float64Array => joined(shaped, length => new Float64Array(length), columnOf);
  const x = joinedAxis(parts);
  if (first.shape === 'point') {
    const points = ofShape(parts, (part): part is IPointData => part.shape === 'point');
    return { shape: 'point', length: x.length, x, value: values(points, part => part.value) };
  }
  const candles = ofShape(parts, (part): part is ICandleData => part.shape === 'candle');
  return {
    shape: 'candle',
    length: x.length,
    x,
    open: values(candles, part => part.open),
    min: values(candles, part => part.min),
    max: values(candles, part => part.max),
    close: values(candles, part => part.close),
  };
}
