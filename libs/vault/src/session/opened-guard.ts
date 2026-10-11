import type { IOpenedVault } from '../codec/vault-codec';
import { toHex } from '../crypto/bytes';
import type { ISyncState as IPersistedSyncState } from '../persistence/ports';
import type { ISyncGuard } from '../sync/sync-state';

/**
 * The guard a session starts with: what the device saw
 * before, raised by the file it just opened. A device that forgot (cleared
 * storage, new device) starts from the file itself.
 */
export function openedGuard(
  opened: IOpenedVault,
  fileHash: string,
  persisted: IPersistedSyncState | null
): ISyncGuard {
  const { header } = opened;
  const fileIsNewest = header.revision >= (persisted?.maxSeenRevision ?? 0);
  return {
    vaultId: toHex(header.vaultId),
    keyId: toHex(header.keyId),
    maxSeenRevision: Math.max(header.revision, persisted?.maxSeenRevision ?? 0),
    maxSeenKeyslotsEpoch: Math.max(header.keyslotsEpoch, persisted?.maxSeenKeyslotsEpoch ?? 0),
    hashAtMaxSeen: fileIsNewest ? fileHash : (persisted?.hashAtMaxSeen ?? null),
    retiredKeyIds: persisted?.retiredKeyIds ?? [],
  };
}
