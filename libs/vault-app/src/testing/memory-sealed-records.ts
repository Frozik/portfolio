import { ok } from '@frozik/utils/result/result';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { ISealedRecordStore } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';

/** Sealed device records in memory, for tests of what is kept on a device. */
export function createMemorySealedRecords(): ISealedRecordStore {
  const records = new Map<string, Map<string, TBytes>>();
  const of = (vaultKey: string): Map<string, TBytes> => {
    const existing = records.get(vaultKey);
    if (!isNil(existing)) {
      return existing;
    }
    const created = new Map<string, TBytes>();
    records.set(vaultKey, created);
    return created;
  };
  return {
    get: (vaultKey, recordKey) => Promise.resolve(ok(of(vaultKey).get(recordKey) ?? null)),
    put: (vaultKey, recordKey, sealed) => {
      of(vaultKey).set(recordKey, sealed);
      return Promise.resolve(ok(undefined));
    },
    delete: (vaultKey, recordKey) => {
      of(vaultKey).delete(recordKey);
      return Promise.resolve(ok(undefined));
    },
    keys: vaultKey => Promise.resolve(ok([...of(vaultKey).keys()])),
  };
}
