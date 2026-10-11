import { openVersionedDatabase } from '@frozik/utils/database';
import { err, ok } from '@frozik/utils/result/result';
import type { DBSchema, IDBPDatabase } from 'idb';

import type { TBytes } from '../../crypto/bytes';
import type { TPersisted } from '../ports';

/** Every device-local fact of every vault, in one database with the `pwv:` prefix. */
export interface IDeviceSchema extends DBSchema {
  registry: { key: string; value: unknown };
  'sync-state': { key: string; value: unknown };
  device: { key: string; value: string };
  drafts: {
    key: [string, string];
    value: { readonly vaultKey: string; readonly recordKey: string; readonly sealed: TBytes };
  };
  usage: {
    key: [string, string];
    value: { readonly vaultKey: string; readonly recordKey: string; readonly sealed: TBytes };
  };
  'device-config': {
    key: [string, string];
    value: { readonly vaultKey: string; readonly recordKey: string; readonly sealed: TBytes };
  };
  snapshots: {
    key: number;
    value: { readonly vaultKey: string; readonly takenAt: number; readonly file: TBytes };
    indexes: { vault: string };
  };
}

export type TSealedStoreName = 'drafts' | 'usage' | 'device-config';

export const DEVICE_DATABASE_NAME = 'pwv:device';
const SCHEMA_VERSION = 1;
const QUOTA_ERROR = 'QuotaExceededError';

export function openDeviceDatabase(name: string): Promise<IDBPDatabase<IDeviceSchema>> {
  return openVersionedDatabase<IDeviceSchema>(name, SCHEMA_VERSION, database => {
    const stores = database.objectStoreNames;
    if (!stores.contains('registry')) {
      database.createObjectStore('registry');
    }
    if (!stores.contains('sync-state')) {
      database.createObjectStore('sync-state');
    }
    if (!stores.contains('device')) {
      database.createObjectStore('device');
    }
    for (const sealed of ['drafts', 'usage', 'device-config'] as const) {
      if (!stores.contains(sealed)) {
        database.createObjectStore(sealed, { keyPath: ['vaultKey', 'recordKey'] });
      }
    }
    if (!stores.contains('snapshots')) {
      database
        .createObjectStore('snapshots', { autoIncrement: true })
        .createIndex('vault', 'vaultKey');
    }
  });
}

export type TRunInDatabase = <T>(
  work: (database: IDBPDatabase<IDeviceSchema>) => Promise<T>
) => TPersisted<T>;

/**
 * Opens the database on first use and runs work in it. The adapters' one
 * `catch`: a platform failure becomes a value, and the
 * next call opens the database again.
 */
export function createDatabaseRunner(
  name: string
): TRunInDatabase & { readonly close: () => Promise<void> } {
  let database: Promise<IDBPDatabase<IDeviceSchema>> | null = null;
  const run = async <T>(
    work: (opened: IDBPDatabase<IDeviceSchema>) => Promise<T>
  ): TPersisted<T> => {
    try {
      database ??= openDeviceDatabase(name);
      return ok(await work(await database));
    } catch (error) {
      database = null;
      return err(
        error instanceof Error && error.name === QUOTA_ERROR
          ? { kind: 'quota' }
          : { kind: 'unavailable' }
      );
    }
  };
  const close = async (): Promise<void> => {
    const opened = database;
    database = null;
    (await opened)?.close();
  };
  return Object.assign(run, { close });
}
