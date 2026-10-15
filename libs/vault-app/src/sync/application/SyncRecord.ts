import type { TStorageRev } from '@frozik/cloud-storage/core/storage-provider';
import type { IHlc } from '@frozik/vault/model/hlc';
import type { ISyncStateStore, TPersisted, TVaultKey } from '@frozik/vault/persistence/ports';
import { guardUnion } from '@frozik/vault/sync/guard-union';
import type { ISyncGuard } from '@frozik/vault/sync/sync-state';
import { uniq } from 'lodash-es';

export type TSyncTarget = 'local' | 'cloud';

/**
 * The one device record both engines save into: revisions are
 * the union of what either saw, the slot epoch is kept per target (a
 * device ahead of its cloud is no rollback), the cloud revision moves
 * only when the cloud engine says so, the clock is the session's.
 */
export class SyncRecord {
  private guard: ISyncGuard;
  private cloudEpoch: number;

  constructor(
    private readonly store: ISyncStateStore,
    private readonly vaultKey: TVaultKey,
    seen: { readonly guard: ISyncGuard; readonly cloudKeyslotsEpoch: number },
    private cloudRevision: TStorageRev | null,
    private readonly clock: () => IHlc
  ) {
    this.guard = seen.guard;
    this.cloudEpoch = seen.cloudKeyslotsEpoch;
  }

  get cloudRev(): TStorageRev | null {
    return this.cloudRevision;
  }

  /** The guard an engine starts from: everything this device has seen, the slot epoch of that target. */
  seenBy(target: TSyncTarget): ISyncGuard {
    return target === 'local'
      ? this.guard
      : { ...this.guard, maxSeenKeyslotsEpoch: this.cloudEpoch };
  }

  /** The cloud has shown no slot set as new as this one: it has yet to get it. */
  cloudBehind(keyslotsEpoch: number): boolean {
    return keyslotsEpoch > this.cloudEpoch;
  }

  save(target: TSyncTarget, guard: ISyncGuard, lastSyncedRev: string | null): TPersisted<void> {
    const localEpoch = this.guard.maxSeenKeyslotsEpoch;
    this.guard = guardUnion(this.guard, {
      ...guard,
      maxSeenKeyslotsEpoch: target === 'local' ? guard.maxSeenKeyslotsEpoch : localEpoch,
    });
    if (target === 'cloud') {
      this.cloudEpoch = Math.max(this.cloudEpoch, guard.maxSeenKeyslotsEpoch);
      this.cloudRevision = lastSyncedRev as TStorageRev | null;
    }
    return this.persist();
  }

  /** This device left a key behind: a file under it is a rollback from now on. */
  retire(keyId: string): TPersisted<void> {
    this.guard = { ...this.guard, retiredKeyIds: uniq([...this.guard.retiredKeyIds, keyId]) };
    return this.persist();
  }

  isRetired(keyId: string): boolean {
    return this.guard.retiredKeyIds.includes(keyId);
  }

  /** A new cloud, or none: its revisions mean nothing to the next one. */
  forgetCloud(): TPersisted<void> {
    this.cloudRevision = null;
    return this.persist();
  }

  private persist(): TPersisted<void> {
    return this.store.put(this.vaultKey, {
      maxSeenRevision: this.guard.maxSeenRevision,
      maxSeenKeyslotsEpoch: this.guard.maxSeenKeyslotsEpoch,
      cloudKeyslotsEpoch: this.cloudEpoch,
      hashAtMaxSeen: this.guard.hashAtMaxSeen,
      retiredKeyIds: this.guard.retiredKeyIds,
      keyId: this.guard.keyId,
      lastSyncedRev: this.cloudRevision,
      lastHlc: this.clock(),
    });
  }
}
