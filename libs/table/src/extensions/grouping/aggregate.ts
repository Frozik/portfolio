import { isNil } from 'lodash-es';

import type { TAnyColumn } from '../../core/columns/column';
import type { TBivariantCallback } from '../../core/kernel/callback';

export type TAggregateName = 'count' | 'sum' | 'min' | 'max' | 'avg';

export type TAggregate<TRow, TValue> =
  | TAggregateName
  | TBivariantCallback<[values: readonly TValue[], rows: readonly TRow[]], unknown>;

declare module '../../core/columns/column' {
  interface IColumnDefinition<TRow, TValue> {
    /** What the column shows on a group or totals row; a function for bigint, decimals or weighted values. */
    readonly aggregate?: TAggregate<TRow, TValue>;
    /** `false` keeps the column out of "group by"; every column can group by default. */
    readonly groupable?: boolean;
    /** The group title for a value; the column text by default. */
    groupTitle?(value: TValue): string;
  }
}

function numbers(values: readonly unknown[]): readonly number[] {
  return values.filter(
    (value): value is number => typeof value === 'number' && !Number.isNaN(value)
  );
}

function builtIn(name: TAggregateName, values: readonly unknown[]): unknown {
  switch (name) {
    case 'count':
      return values.length;
    case 'sum':
      return numbers(values).reduce((sum, value) => sum + value, 0);
    case 'min': {
      const present = numbers(values);
      return present.length === 0 ? undefined : Math.min(...present);
    }
    case 'max': {
      const present = numbers(values);
      return present.length === 0 ? undefined : Math.max(...present);
    }
    case 'avg': {
      const present = numbers(values);
      return present.length === 0
        ? undefined
        : present.reduce((sum, value) => sum + value, 0) / present.length;
    }
  }
}

/** The aggregate of every column that declares one, over the given rows. */
export function aggregateRows<TRow>(
  columns: readonly TAnyColumn<TRow>[],
  rows: readonly TRow[]
): Readonly<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  for (const column of columns) {
    const { aggregate } = column;
    if (isNil(aggregate)) {
      continue;
    }
    const values = rows.map(row => column.value(row));
    result[column.id] =
      typeof aggregate === 'string' ? builtIn(aggregate, values) : aggregate(values, rows);
  }
  return result;
}
