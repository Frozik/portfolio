import type { Milliseconds } from '@frozik/utils/date/types';
import type { TVaultKey } from '@frozik/vault/persistence/ports';

/**
 * A quick lock's key, in `chrome.storage.session`: the vault's key sealed
 * under a key derived from the PIN and a random pepper beside it. A memory
 * dump finds neither the vault's key nor the PIN; the PIN gets one try.
 */
export interface IQuickLockRecord {
  readonly vaultKey: TVaultKey;
  readonly keyId: Uint8Array<ArrayBuffer>;
  /** The vault's raw key, AES-GCM under the quick key: the IV, then the ciphertext. */
  readonly wrapped: Uint8Array<ArrayBuffer>;
  readonly pepper: Uint8Array<ArrayBuffer>;
  /** The PIN's length: the pad sends it on the last digit. */
  readonly digits: number;
}

export interface IQuickLockStore {
  load(): Promise<IQuickLockRecord | null>;
  save(record: IQuickLockRecord): Promise<void>;
  clear(): Promise<void>;
}

/** When the master password was last typed for a vault, in the open: a date, no secret. */
export interface ILastMasterStore {
  load(vaultKey: TVaultKey): Promise<Milliseconds | null>;
  save(vaultKey: TVaultKey, at: Milliseconds): Promise<void>;
}

/** The quick lock's lifetime, after which it becomes a full one. */
export interface IQuickExpiryAlarm {
  set(delayMs: number): Promise<void>;
  cancel(): Promise<void>;
}
