import { isNil } from 'lodash-es';

import type { TSqlRow } from './sql-driver';

/** A column read as the type the schema gave it; a row that disagrees is no row of this table. */
export function textOf(row: TSqlRow, column: string): string | null {
  const value = row[column];
  return typeof value === 'string' ? value : null;
}

export function numberOf(row: TSqlRow, column: string): number | null {
  const value = row[column];
  return typeof value === 'number' ? value : null;
}

export function bytesOf(row: TSqlRow, column: string): Uint8Array<ArrayBuffer> | null {
  const value = row[column];
  return value instanceof Uint8Array ? value.slice() : null;
}

/** `NULL` kept apart from a column of another type. */
export function isNullIn(row: TSqlRow, column: string): boolean {
  return isNil(row[column]);
}
