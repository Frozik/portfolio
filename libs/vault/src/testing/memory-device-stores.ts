import { ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import type { TBytes } from '../crypto/bytes';
import { randomUuid } from '../model/ids';
import type {
  IDeviceStores,
  IKnownVault,
  ISealedRecordStore,
  ISnapshot,
  ISyncState,
  TPersisted,
  TVaultKey,
} from '../persistence/ports';
import { raisedSyncState } from '../persistence/sync-state-ratchet';
import type { IRandom } from '../ports/random';
import type { TOpenDeviceStores } from './device-stores-contract';

const done = <T>(value: T): TPersisted<T> => Promise.resolve(ok(value));

function sealedRecords(): ISealedRecordStore & { readonly wipe: () => void } {
  const byVault = new Map<TVaultKey, Map<string, TBytes>>();
  const of = (vaultKey: TVaultKey): Map<string, TBytes> => {
    const existing = byVault.get(vaultKey);
    if (!isNil(existing)) {
      return existing;
    }
    const created = new Map<string, TBytes>();
    byVault.set(vaultKey, created);
    return created;
  };
  return {
    get: (vaultKey, recordKey) => done(of(vaultKey).get(recordKey) ?? null),
    put: (vaultKey, recordKey, sealed) => done(void of(vaultKey).set(recordKey, sealed)),
    delete: (vaultKey, recordKey) => done(void of(vaultKey).delete(recordKey)),
    keys: vaultKey => done([...of(vaultKey).keys()]),
    wipe: () => byVault.clear(),
  };
}

interface IStoredSnapshot extends ISnapshot {
  readonly id: number;
  readonly vaultKey: TVaultKey;
}

/** The later added first, whatever its clock said: a clock that went back must not reorder them. */
function newestFirst(first: IStoredSnapshot, second: IStoredSnapshot): number {
  return second.id - first.id;
}

/**
 * One device's stores in memory: every `open` sees what the earlier ones
 * wrote, the way a browser profile's IndexedDB outlives a reload. Passes the
 * device stores contract.
 */
export function createMemoryDevice(): TOpenDeviceStores {
  let deviceId: string | null = null;
  const registry = new Map<TVaultKey, IKnownVault>();
  const syncStates = new Map<TVaultKey, ISyncState>();
  let snapshots: IStoredSnapshot[] = [];
  let nextSnapshotId = 1;
  const drafts = sealedRecords();
  const usage = sealedRecords();
  const deviceConfig = sealedRecords();

  return (random: IRandom): IDeviceStores => ({
    registry: {
      list: () => done([...registry.values()]),
      put: vault => done(void registry.set(vault.vaultKey, vault)),
      remove: vaultKey => done(void registry.delete(vaultKey)),
    },
    syncState: {
      deviceId: () => done((deviceId ??= randomUuid(random))),
      get: vaultKey => done(syncStates.get(vaultKey) ?? null),
      put: (vaultKey, state) => {
        const stored = syncStates.get(vaultKey);
        syncStates.set(vaultKey, isNil(stored) ? state : raisedSyncState(stored, state));
        return done(undefined);
      },
      remove: vaultKey => done(void syncStates.delete(vaultKey)),
    },
    drafts,
    usage,
    deviceConfig,
    snapshots: {
      add: (vaultKey, snapshot, keep) => {
        snapshots.push({ ...snapshot, vaultKey, id: nextSnapshotId++ });
        const kept = new Set(
          snapshots
            .filter(entry => entry.vaultKey === vaultKey)
            .sort(newestFirst)
            .slice(0, keep)
        );
        snapshots = snapshots.filter(entry => entry.vaultKey !== vaultKey || kept.has(entry));
        return done(undefined);
      },
      list: vaultKey =>
        done(
          snapshots
            .filter(entry => entry.vaultKey === vaultKey)
            .sort(newestFirst)
            .map(({ id, takenAt, reason, file }) => ({ id, takenAt, reason, size: file.length }))
        ),
      read: (vaultKey, id) =>
        done(snapshots.find(entry => entry.vaultKey === vaultKey && entry.id === id)?.file ?? null),
      clear: vaultKey => {
        snapshots = snapshots.filter(entry => entry.vaultKey !== vaultKey);
        return done(undefined);
      },
    },
    forgetDevice: () => {
      deviceId = null;
      registry.clear();
      syncStates.clear();
      snapshots = [];
      [drafts, usage, deviceConfig].forEach(store => store.wipe());
      return done(undefined);
    },
  });
}
