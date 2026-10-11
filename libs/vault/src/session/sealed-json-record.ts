import type { THkdfLabel } from '../crypto/hkdf';
import { deriveAesKey } from '../crypto/hkdf';
import type { ISealedRecordStore, TPersisted, TVaultKey } from '../persistence/ports';
import { openRecord, sealRecord } from '../persistence/record-cipher';
import type { IRandom } from '../ports/random';

/** One JSON value in a device store, sealed under a subkey of the vault's key. */
export interface ISealedJsonRecord<T> {
  save(value: T): TPersisted<void>;
  /** `null` when there is none, it does not open (another key) or it is not a `T` any more. */
  load(): Promise<T | null>;
  clear(): TPersisted<void>;
}

export function createSealedJsonRecord<T>({
  store,
  vaultKey,
  recordKey,
  dek,
  label,
  random,
  decode,
}: {
  readonly store: ISealedRecordStore;
  readonly vaultKey: TVaultKey;
  readonly recordKey: string;
  readonly dek: CryptoKey;
  readonly label: THkdfLabel;
  readonly random: IRandom;
  readonly decode: (value: unknown) => T | null;
}): ISealedJsonRecord<T> {
  const slot = { vaultKey, recordKey };
  const key = deriveAesKey(dek, label);
  /** Sealing takes a moment: a clear issued meanwhile must not be overtaken by the save before it. */
  let queue: Promise<unknown> = Promise.resolve();
  const inTurn = <R>(operation: () => Promise<R>): Promise<R> => {
    const next = queue.then(operation, operation);
    queue = next;
    return next;
  };
  return {
    save: value =>
      inTurn(async () =>
        store.put(vaultKey, recordKey, await sealRecord(await key, slot, value, random))
      ),
    load: () =>
      inTurn(async () => {
        const sealed = await store.get(vaultKey, recordKey);
        if (!sealed.ok || sealed.value === null) {
          return null;
        }
        const opened = await openRecord(await key, slot, sealed.value);
        return opened.ok ? decode(opened.value) : null;
      }),
    clear: () => inTurn(() => store.delete(vaultKey, recordKey)),
  };
}
