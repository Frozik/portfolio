/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';

import { createSqlProvider } from '@frozik/cloud-storage/sql/sql-provider';
import { describeStorageProviderContract } from '@frozik/cloud-storage/testing/storage-contract';
import type { TSqlValue } from '@frozik/utils/sql/sql-driver';
import { createSqlDeviceStores } from '@frozik/vault/persistence/sql/device-stores';
import { describeDeviceStoresContract } from '@frozik/vault/testing/device-stores-contract';
import type { SQLiteDatabase } from 'expo-sqlite';

import { expoSqlDriver } from './expo-sql-driver';

/** The slice of `expo-sqlite`'s database the driver calls, answered by the same engine. */
function sqliteLikeExpo(): SQLiteDatabase {
  const database = new DatabaseSync(':memory:');
  const fake = {
    runAsync: async (sql: string, params: TSqlValue[]) => {
      const { changes, lastInsertRowid } = database.prepare(sql).run(...params);
      return { changes: Number(changes), lastInsertRowId: Number(lastInsertRowid) };
    },
    getAllAsync: async <T>(sql: string, params: TSqlValue[]) =>
      database.prepare(sql).all(...params) as T[],
    execAsync: async (sql: string) => {
      database.exec(sql);
    },
  } as Pick<SQLiteDatabase, 'runAsync' | 'getAllAsync' | 'execAsync'>;
  return fake as SQLiteDatabase;
}

describeStorageProviderContract('expo-sqlite', () =>
  createSqlProvider({ driver: expoSqlDriver(sqliteLikeExpo()), namespace: 'vault' })
);

describeDeviceStoresContract('expo-sqlite', () => {
  const driver = expoSqlDriver(sqliteLikeExpo());
  return random => createSqlDeviceStores(driver, random);
});
