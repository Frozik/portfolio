import type { ISealedRecordStore } from '../ports';
import type { TRunInDatabase, TSealedStoreName } from './device-database';

/** Bytes sealed by `record-cipher` before they come here; the store never sees plaintext. */
export function createSealedRecordStore(
  run: TRunInDatabase,
  store: TSealedStoreName
): ISealedRecordStore {
  return {
    get: (vaultKey, recordKey) =>
      run(async database => (await database.get(store, [vaultKey, recordKey]))?.sealed ?? null),
    put: (vaultKey, recordKey, sealed) =>
      run(async database => void (await database.put(store, { vaultKey, recordKey, sealed }))),
    delete: (vaultKey, recordKey) => run(database => database.delete(store, [vaultKey, recordKey])),
    keys: vaultKey =>
      run(async database =>
        (await database.getAll(store, IDBKeyRange.bound([vaultKey, ''], [vaultKey, '￿']))).map(
          record => record.recordKey
        )
      ),
  };
}
