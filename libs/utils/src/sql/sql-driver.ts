/** What a column holds in the SQL the shared stores use: SQLite's storage classes, BLOB as bytes. */
export type TSqlValue = string | number | null | Uint8Array<ArrayBuffer>;

export type TSqlRow = Readonly<Record<string, TSqlValue>>;

/**
 * The one SQL port the shared stores speak: SQLite through `node:sqlite` in
 * tests and `expo-sqlite` on a phone. Statements are plain SQL with `?`
 * parameters; nothing dialect-specific beyond SQLite's.
 */
export interface ISqlStatements {
  /** A statement without rows: schema, insert, update, delete. */
  run(sql: string, params?: readonly TSqlValue[]): Promise<void>;
  all(sql: string, params?: readonly TSqlValue[]): Promise<readonly TSqlRow[]>;
}

export interface ISqlDriver extends ISqlStatements {
  /**
   * The work runs alone and as one through `tx`: every other statement waits
   * for it, and a failure rolls all of it back and is thrown on.
   */
  transaction<T>(work: (tx: ISqlStatements) => Promise<T>): Promise<T>;
}
