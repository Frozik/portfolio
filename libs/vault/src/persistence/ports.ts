import type { Milliseconds } from '@frozik/utils/date/types';
import type { TResult } from '@frozik/utils/result/result';

import type { TBytes } from '../crypto/bytes';
import type { IHlc } from '../model/hlc';

/** The device store failed: a full disk, or site data blocked (private browsing). */
export type TPersistenceError = { readonly kind: 'quota' } | { readonly kind: 'unavailable' };

export type TPersisted<T> = Promise<TResult<T, TPersistenceError>>;

/** Hex of the header's VAULT_ID: the key every device store files a vault under. */
export type TVaultKey = string;

/**
 * What this device lists of a vault before it is unlocked: its name and
 * when it was opened. Where it lives — the cloud, the address, the login —
 * is sealed with the vault's key and read only after the unlock.
 */
export interface IKnownVault {
  readonly vaultKey: TVaultKey;
  readonly name: string;
  readonly lastOpenedAt: Milliseconds | null;
  /** A write that met a conflict after locking waits for the next unlock. */
  readonly unsyncedChanges: boolean;
}

/** The vaults this device knows; open, nothing secret. */
export interface IVaultRegistry {
  list(): TPersisted<readonly IKnownVault[]>;
  put(vault: IKnownVault): TPersisted<void>;
  remove(vaultKey: TVaultKey): TPersisted<void>;
}

/** What guards against rollback and keeps the clock moving forward. */
export interface ISyncState {
  readonly maxSeenRevision: number;
  /** The newest slot set the local copy has shown. */
  readonly maxSeenKeyslotsEpoch: number;
  /**
   * The newest slot set the cloud has shown, kept apart: a device that changed
   * the password offline is ahead of its cloud, which is not a rollback.
   */
  readonly cloudKeyslotsEpoch: number;
  /** Keys this device rotated away from (hex KEY_IDs). */
  readonly retiredKeyIds: readonly string[];
  /** Hash of the file seen at `maxSeenRevision`: the same revision with other bytes is a rollback too. */
  readonly hashAtMaxSeen: string | null;
  readonly keyId: string;
  readonly lastSyncedRev: string | null;
  readonly lastHlc: IHlc | null;
}

export interface ISyncStateStore {
  /** Random on first use, then the same for this browser profile and origin. */
  deviceId(): TPersisted<string>;
  get(vaultKey: TVaultKey): TPersisted<ISyncState | null>;
  put(vaultKey: TVaultKey, state: ISyncState): TPersisted<void>;
  remove(vaultKey: TVaultKey): TPersisted<void>;
}

/**
 * Records encrypted under a subkey of the vault's key: drafts
 * (`K_draft`), recently used (`K_usage`), provider credentials
 * (`K_device_cfg`). The store keeps sealed bytes only.
 */
export interface ISealedRecordStore {
  get(vaultKey: TVaultKey, recordKey: string): TPersisted<TBytes | null>;
  put(vaultKey: TVaultKey, recordKey: string, sealed: TBytes): TPersisted<void>;
  delete(vaultKey: TVaultKey, recordKey: string): TPersisted<void>;
  keys(vaultKey: TVaultKey): TPersisted<readonly string[]>;
}

export interface ISnapshot {
  readonly takenAt: Milliseconds;
  /** A sealed `.pwv`, the same format as the vault itself. */
  readonly file: TBytes;
}

/** The last local versions before a cloud version changed something, as insurance against a merge bug. */
export interface ISnapshotStore {
  add(vaultKey: TVaultKey, snapshot: ISnapshot): TPersisted<void>;
  list(vaultKey: TVaultKey): TPersisted<readonly ISnapshot[]>;
  clear(vaultKey: TVaultKey): TPersisted<void>;
}

/** "forget this device": every store of every vault on it. */
export interface IDeviceStores {
  readonly registry: IVaultRegistry;
  readonly syncState: ISyncStateStore;
  readonly drafts: ISealedRecordStore;
  readonly usage: ISealedRecordStore;
  readonly deviceConfig: ISealedRecordStore;
  readonly snapshots: ISnapshotStore;
  forgetDevice(): TPersisted<void>;
}
