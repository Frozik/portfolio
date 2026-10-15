import type { Milliseconds } from '@frozik/utils/date/types';
import { err, ok } from '@frozik/utils/result/result';
import type { ISqlDriver } from '@frozik/utils/sql/sql-driver';
import { bytesOf, numberOf, textOf } from '@frozik/utils/sql/sql-row';
import { isNil } from 'lodash-es';

import { randomUuid } from '../../model/ids';
import type { IRandom } from '../../ports/random';
import type { IDeviceStores, ISealedRecordStore, TPersisted } from '../ports';
import { readKnownVault, readSyncState, snapshotReasonOf } from '../stored-records';
import { raisedSyncState } from '../sync-state-ratchet';
import { createDeviceSchema, DEVICE_TABLES } from './device-schema';

const DEVICE_ID_KEY = 'device-id';
/** SQLite's "database or disk is full". */
const FULL = /full/i;

type TRun = <T>(work: () => Promise<T>) => TPersisted<T>;

function parsed(text: string | null): unknown {
  return isNil(text) ? null : JSON.parse(text);
}

function sealedRecordStore(driver: ISqlDriver, run: TRun, store: string): ISealedRecordStore {
  return {
    get: (vaultKey, recordKey) =>
      run(async () => {
        const [row] = await driver.all(
          'SELECT sealed FROM sealed_records WHERE store = ? AND vault_key = ? AND record_key = ?',
          [store, vaultKey, recordKey]
        );
        return isNil(row) ? null : bytesOf(row, 'sealed');
      }),
    put: (vaultKey, recordKey, sealed) =>
      run(() =>
        driver.run(
          `INSERT INTO sealed_records (store, vault_key, record_key, sealed) VALUES (?, ?, ?, ?)
           ON CONFLICT (store, vault_key, record_key) DO UPDATE SET sealed = excluded.sealed`,
          [store, vaultKey, recordKey, sealed.slice()]
        )
      ),
    delete: (vaultKey, recordKey) =>
      run(() =>
        driver.run(
          'DELETE FROM sealed_records WHERE store = ? AND vault_key = ? AND record_key = ?',
          [store, vaultKey, recordKey]
        )
      ),
    keys: vaultKey =>
      run(async () =>
        (
          await driver.all(
            'SELECT record_key FROM sealed_records WHERE store = ? AND vault_key = ? ORDER BY record_key',
            [store, vaultKey]
          )
        ).flatMap(row => {
          const key = textOf(row, 'record_key');
          return isNil(key) ? [] : [key];
        })
      ),
  };
}

/**
 * Every device store over one SQLite database — the phone's, through
 * `expo-sqlite`; the same contract as the browser's IndexedDB. Sealed
 * records and snapshots are ciphertext; the registry holds what the start
 * screen shows before any unlock.
 */
export function createSqlDeviceStores(driver: ISqlDriver, random: IRandom): IDeviceStores {
  let schema: Promise<void> | null = null;
  /** The adapters' one `catch`: a database failure becomes a value. */
  const run: TRun = async work => {
    try {
      schema ??= createDeviceSchema(driver);
      await schema;
      return ok(await work());
    } catch (error) {
      schema = null;
      return err(
        error instanceof Error && FULL.test(error.message)
          ? { kind: 'quota' }
          : { kind: 'unavailable' }
      );
    }
  };
  return {
    registry: {
      list: () =>
        run(async () =>
          (await driver.all('SELECT record FROM vault_registry ORDER BY rowid')).flatMap(row =>
            readKnownVault(parsed(textOf(row, 'record')))
          )
        ),
      put: vault =>
        run(() =>
          driver.run(
            `INSERT INTO vault_registry (vault_key, record) VALUES (?, ?)
             ON CONFLICT (vault_key) DO UPDATE SET record = excluded.record`,
            [vault.vaultKey, JSON.stringify(vault)]
          )
        ),
      remove: vaultKey =>
        run(() => driver.run('DELETE FROM vault_registry WHERE vault_key = ?', [vaultKey])),
    },
    syncState: {
      deviceId: () =>
        run(() =>
          driver.transaction(async tx => {
            const [row] = await tx.all('SELECT value FROM device WHERE key = ?', [DEVICE_ID_KEY]);
            const existing = isNil(row) ? null : textOf(row, 'value');
            if (!isNil(existing)) {
              return existing;
            }
            const created = randomUuid(random);
            await tx.run('INSERT INTO device (key, value) VALUES (?, ?)', [DEVICE_ID_KEY, created]);
            return created;
          })
        ),
      get: vaultKey =>
        run(async () => {
          const [row] = await driver.all('SELECT record FROM sync_state WHERE vault_key = ?', [
            vaultKey,
          ]);
          return isNil(row) ? null : readSyncState(parsed(textOf(row, 'record')));
        }),
      put: (vaultKey, state) =>
        run(() =>
          driver.transaction(async tx => {
            const [row] = await tx.all('SELECT record FROM sync_state WHERE vault_key = ?', [
              vaultKey,
            ]);
            const stored = isNil(row) ? null : readSyncState(parsed(textOf(row, 'record')));
            await tx.run(
              `INSERT INTO sync_state (vault_key, record) VALUES (?, ?)
               ON CONFLICT (vault_key) DO UPDATE SET record = excluded.record`,
              [vaultKey, JSON.stringify(isNil(stored) ? state : raisedSyncState(stored, state))]
            );
          })
        ),
      remove: vaultKey =>
        run(() => driver.run('DELETE FROM sync_state WHERE vault_key = ?', [vaultKey])),
    },
    drafts: sealedRecordStore(driver, run, 'drafts'),
    usage: sealedRecordStore(driver, run, 'usage'),
    deviceConfig: sealedRecordStore(driver, run, 'device-config'),
    snapshots: {
      add: (vaultKey, { takenAt, reason, file }, keep) =>
        run(() =>
          driver.transaction(async tx => {
            await tx.run(
              'INSERT INTO snapshots (vault_key, taken_at, reason, size, file) VALUES (?, ?, ?, ?, ?)',
              [vaultKey, takenAt, reason, file.byteLength, file.slice()]
            );
            await tx.run(
              `DELETE FROM snapshots WHERE vault_key = ? AND id NOT IN (
                 SELECT id FROM snapshots WHERE vault_key = ? ORDER BY id DESC LIMIT ?
               )`,
              [vaultKey, vaultKey, keep]
            );
          })
        ),
      list: vaultKey =>
        run(async () =>
          (
            await driver.all(
              'SELECT id, taken_at, reason, size FROM snapshots WHERE vault_key = ? ORDER BY id DESC',
              [vaultKey]
            )
          ).flatMap(row => {
            const id = numberOf(row, 'id');
            const takenAt = numberOf(row, 'taken_at');
            const size = numberOf(row, 'size');
            return isNil(id) || isNil(takenAt) || isNil(size)
              ? []
              : [
                  {
                    id,
                    takenAt: takenAt as Milliseconds,
                    reason: snapshotReasonOf(textOf(row, 'reason')),
                    size,
                  },
                ];
          })
        ),
      read: (vaultKey, id) =>
        run(async () => {
          const [row] = await driver.all(
            'SELECT file FROM snapshots WHERE vault_key = ? AND id = ?',
            [vaultKey, id]
          );
          return isNil(row) ? null : bytesOf(row, 'file');
        }),
      clear: vaultKey =>
        run(() => driver.run('DELETE FROM snapshots WHERE vault_key = ?', [vaultKey])),
    },
    forgetDevice: () =>
      run(() =>
        driver.transaction(async tx => {
          for (const table of DEVICE_TABLES) {
            await tx.run(`DELETE FROM ${table}`);
          }
        })
      ),
  };
}
