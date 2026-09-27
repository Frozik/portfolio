import { columnText } from '../columns/column';
import type { TAnyColumn } from '../columns/column';

export type TSerializeFormat = 'tsv' | 'csv' | 'json';

export interface ISerializeOptions {
  readonly format: TSerializeFormat;
  readonly headers?: boolean;
  /** CSV only; a comma unless the locale of the consumer wants a semicolon. */
  readonly delimiter?: string;
}

const CSV_DELIMITER = ',';

/** The text of one cell for the clipboard and exports: the formatted text, or the raw value when the column asks for it. */
export function cellText<TRow>(row: TRow, column: TAnyColumn<TRow>): string {
  if (column.copy !== 'raw') {
    return columnText(column, row);
  }
  const value = column.value(row);
  if (value === null || value === undefined) {
    return '';
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function csvField(delimiter: string): (text: string) => string {
  return text =>
    text.includes(delimiter) || /["\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function tsvField(text: string): string {
  return text.replaceAll(/[\t\r\n]/g, ' ');
}

function title<TRow>(column: TAnyColumn<TRow>): string {
  return typeof column.title === 'string' ? column.title : column.title.text;
}

/** Rows as text in the visible column order: TSV for the clipboard, CSV (RFC 4180) for files, JSON objects keyed by column id. */
export function serializeRows<TRow>(
  rows: readonly TRow[],
  columns: readonly TAnyColumn<TRow>[],
  options: ISerializeOptions
): string {
  if (options.format === 'json') {
    return JSON.stringify(
      rows.map(row =>
        Object.fromEntries(columns.map(column => [column.id, cellText(row, column)]))
      ),
      null,
      2
    );
  }
  const separator = options.format === 'csv' ? (options.delimiter ?? CSV_DELIMITER) : '\t';
  const field = options.format === 'csv' ? csvField(separator) : tsvField;
  const lines = rows.map(row =>
    columns.map(column => field(cellText(row, column))).join(separator)
  );
  if (options.headers === true) {
    lines.unshift(columns.map(column => field(title(column))).join(separator));
  }
  return lines.join(options.format === 'csv' ? '\r\n' : '\n');
}
