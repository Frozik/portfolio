/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';

import { serialisedSqlDriver } from '../serialised-sql-driver';
import type { ISqlDriver, TSqlRow } from '../sql-driver';

/** Node's own SQLite for tests: the same SQL a phone runs through `expo-sqlite`, in memory unless given a file. */
export function createNodeSqliteDriver(path = ':memory:'): ISqlDriver {
  const database = new DatabaseSync(path);
  return serialisedSqlDriver({
    run: async (sql, params) => {
      database.prepare(sql).run(...params);
    },
    all: async (sql, params) => database.prepare(sql).all(...params) as readonly TSqlRow[],
    exec: async sql => {
      database.exec(sql);
    },
  });
}
