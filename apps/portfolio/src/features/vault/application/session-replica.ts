import type { IStorageProvider, TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
import type { IVaultCodec } from '@frozik/vault/codec/vault-codec';
import type { TManifest } from '@frozik/vault/format/manifest';
import type { IVaultKeys } from '@frozik/vault/format/vault-keys';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import type { IRandom } from '@frozik/vault/ports/random';
import type { ISyncReplica } from '@frozik/vault/session/sync-effect-runner';
import type { ISyncGuard } from '@frozik/vault/sync/sync-state';

import type { ISessionClock } from '../domain/ports/session-clock';

/** One storage target of the session as its engine sees it; the session's half comes in as callbacks. */
export function createSessionReplica({
  provider,
  path,
  codec,
  random,
  keys,
  adoptKeys,
  keysShared,
  manifest,
  clock,
  document,
  merge,
  saveGuard,
}: {
  readonly provider: IStorageProvider;
  readonly path: TStoragePath;
  readonly codec: IVaultCodec;
  readonly random: IRandom;
  /** The session's keys as they are now: the slot set changes while the session runs. */
  readonly keys: () => IVaultKeys;
  readonly adoptKeys: (keys: IVaultKeys) => void;
  readonly keysShared: (keyslotsEpoch: number) => void;
  readonly manifest: TManifest;
  readonly clock: ISessionClock;
  readonly document: () => IVaultDocument;
  readonly merge: (remote: IVaultDocument) => boolean;
  readonly saveGuard: (guard: ISyncGuard, lastSyncedRev: string | null) => Promise<void>;
}): ISyncReplica {
  return {
    provider,
    path,
    codec,
    random,
    get keys() {
      return keys();
    },
    adoptKeys,
    keysShared,
    manifest,
    document,
    merge,
    saveGuard,
    wait: (ms, signal) =>
      new Promise(resolve => {
        const cancel = clock.after(ms, () => resolve(true));
        signal.addEventListener(
          'abort',
          () => {
            cancel();
            resolve(false);
          },
          { once: true }
        );
      }),
  };
}
