import { serialisedSqlDriver } from '@frozik/utils/sql/serialised-sql-driver';
import type { ISqlDriver, TSqlRow } from '@frozik/utils/sql/sql-driver';
import type { SQLiteDatabase } from 'expo-sqlite';

export function expoSqlDriver(database: SQLiteDatabase): ISqlDriver {
  return serialisedSqlDriver({
    run: async (sql, params) => {
      await database.runAsync(sql, [...params]);
    },
    all: (sql, params) => database.getAllAsync<TSqlRow>(sql, [...params]),
    exec: sql => database.execAsync(sql),
  });
}
