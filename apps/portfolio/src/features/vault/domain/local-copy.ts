import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import type { TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
import type { TVaultKey } from '@frozik/vault/persistence/ports';

/** One IndexedDB database per vault, so forgetting a vault drops one database. */
export function localCopyDatabase(vaultKey: TVaultKey): string {
  return `pwv:vault:${vaultKey}`;
}

export const LOCAL_COPY_PATH: TStoragePath = storagePath('vault.pwv');
