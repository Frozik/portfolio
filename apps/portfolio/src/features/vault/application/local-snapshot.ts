import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import type { Milliseconds } from '@frozik/utils/date/types';
import type { ISnapshotStore, TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';

import { LOCAL_COPY_PATH } from '../domain/local-copy';

/**
 * The local copy as it was, kept before a cloud version changes
 * it (the store keeps the last ten). Read before the merged document is
 * written over it: that write seals in the Worker first.
 */
export async function keepLocalSnapshot(
  {
    vaultKey,
    localCopy,
    snapshots,
    takenAt,
  }: {
    readonly vaultKey: TVaultKey;
    readonly localCopy: IStorageProvider;
    readonly snapshots: ISnapshotStore;
    readonly takenAt: Milliseconds;
  },
  signal: AbortSignal
): Promise<void> {
  const read = await localCopy.read(LOCAL_COPY_PATH, signal);
  if (read.ok && !isNil(read.value)) {
    await snapshots.add(vaultKey, { takenAt, file: read.value.bytes });
  }
}
