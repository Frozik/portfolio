import { err, ok } from '@frozik/utils/result/result';

import type { IDeviceStores, TPersisted, TVaultKey } from '../persistence/ports';

/**
 * This device forgets one vault: the registry entry, what it
 * saw of it, its sealed records and snapshots. The local copy's own storage
 * is the caller's (a provider of its own). Other devices and the cloud keep it.
 */
export async function forgetVaultOnDevice(
  stores: Omit<IDeviceStores, 'forgetDevice'>,
  vaultKey: TVaultKey
): TPersisted<void> {
  const sealedStores = [stores.drafts, stores.usage, stores.deviceConfig];
  const results = await Promise.all([
    stores.registry.remove(vaultKey),
    stores.syncState.remove(vaultKey),
    stores.snapshots.clear(vaultKey),
    ...sealedStores.map(async store => {
      const keys = await store.keys(vaultKey);
      if (!keys.ok) {
        return keys;
      }
      const deleted = await Promise.all(keys.value.map(key => store.delete(vaultKey, key)));
      return deleted.find(result => !result.ok) ?? ok(undefined);
    }),
  ]);
  const failed = results.find(result => !result.ok);
  return failed === undefined || failed.ok ? ok(undefined) : err(failed.error);
}
