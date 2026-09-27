export type TColumnKind = 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'custom';
export type TPinSide = 'left' | 'right';
export type TAlign = 'start' | 'end' | 'center';

export interface IColumnLock {
  readonly pin?: boolean;
  readonly move?: boolean;
  readonly hide?: boolean;
  readonly resize?: boolean;
}

export interface IColumnTitle {
  readonly text: string;
}

/**
 * A column as the application declares it: defaults only. Everything the user
 * changes lives in the table state. Value accessors are methods so a column of
 * one value type is assignable to `IColumnDefinition<TRow, unknown>`.
 * Extensions add their fields through declaration merging.
 */
export interface IColumnDefinition<TRow, TValue = unknown> {
  readonly id: string;
  readonly title: string | IColumnTitle;
  readonly kind: TColumnKind;
  value(row: TRow): TValue;
  format?(value: TValue, row: TRow): string;
  set?(row: TRow, value: TValue): TRow;
  equals?(left: TValue, right: TValue): boolean;
  readonly width?: number;
  readonly minWidth?: number;
  readonly maxWidth?: number;
  readonly flex?: number;
  readonly pin?: TPinSide;
  readonly hidden?: boolean;
  readonly align?: TAlign;
  readonly wrap?: boolean;
  readonly interactive?: boolean;
  readonly lock?: IColumnLock;
  readonly copy?: 'text' | 'raw';
}

export type TAnyColumn<TRow> = IColumnDefinition<TRow, unknown>;

export function columnTitle<TRow>(column: TAnyColumn<TRow>): string {
  return typeof column.title === 'string' ? column.title : column.title.text;
}

export function columnText<TRow, TValue>(
  column: IColumnDefinition<TRow, TValue>,
  row: TRow
): string {
  const value = column.value(row);
  if (column.format !== undefined) {
    return column.format(value, row);
  }
  if (value === null || value === undefined) {
    return '';
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function column<TRow>() {
  return <TValue>(definition: IColumnDefinition<TRow, TValue>): IColumnDefinition<TRow, TValue> =>
    definition;
}

export function defineColumns<TRow>() {
  return <const TColumns extends readonly TAnyColumn<TRow>[]>(columns: TColumns): TColumns =>
    columns;
}
