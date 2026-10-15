import type { ISqlDriver, ISqlStatements, TSqlRow, TSqlValue } from './sql-driver';

/** One SQLite connection as the engine gives it: statements and a raw script. */
export interface ISqlConnection {
  run(sql: string, params: readonly TSqlValue[]): Promise<void>;
  all(sql: string, params: readonly TSqlValue[]): Promise<readonly TSqlRow[]>;
  exec(sql: string): Promise<void>;
}

/**
 * The driver over one connection: every call queues, and a transaction holds
 * the queue until it ends, so an `await` inside one never lets another
 * caller's statement into it. Only its own `tx` reaches the connection then.
 */
export function serialisedSqlDriver(connection: ISqlConnection): ISqlDriver {
  let tail: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const next = tail.then(work, work);
    tail = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };
  const statements: ISqlStatements = {
    run: (sql, params = []) => connection.run(sql, params),
    all: (sql, params = []) => connection.all(sql, params),
  };
  return {
    run: (sql, params) => exclusive(() => statements.run(sql, params)),
    all: (sql, params) => exclusive(() => statements.all(sql, params)),
    transaction: work =>
      exclusive(async () => {
        await connection.exec('BEGIN IMMEDIATE');
        try {
          const result = await work(statements);
          await connection.exec('COMMIT');
          return result;
        } catch (error) {
          await connection.exec('ROLLBACK');
          throw error;
        }
      }),
  };
}
