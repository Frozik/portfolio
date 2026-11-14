import { serialisedSqlDriver } from '@frozik/utils/sql/serialised-sql-driver';
import type { ISqlDriver, TSqlRow } from '@frozik/utils/sql/sql-driver';
import type { SQLiteDatabase } from 'expo-sqlite';

const never = (): Promise<never> => new Promise(() => undefined);

/**
 * The driver, and a seal that waits for every statement already queued and keeps any later one
 * from the connection. The connection is not closed: expo-sqlite crashed natively on a statement
 * to a closed database, and on closing it again as the runtime went down.
 */
export function expoSqlDriver(database: SQLiteDatabase): {
  readonly driver: ISqlDriver;
  readonly seal: () => Promise<void>;
} {
  let sealed = false;
  const driver = serialisedSqlDriver({
    run: async (sql, params) => {
      if (sealed) {
        return never();
      }
      await database.runAsync(sql, [...params]);
    },
    all: (sql, params) => (sealed ? never() : database.getAllAsync<TSqlRow>(sql, [...params])),
    exec: sql => (sealed ? never() : database.execAsync(sql)),
  });
  return {
    driver,
    seal: async () => {
      await driver.all('SELECT 1', []);
      sealed = true;
    },
  };
}
