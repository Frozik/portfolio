import type { Milliseconds } from '@frozik/utils/date/types';
import { err, ok } from '@frozik/utils/result/result';
import { EValueDescriptorErrorCode } from '@frozik/utils/value-descriptors/codes';
import type { IKnownVault, IVaultRegistry, TVaultKey } from '@frozik/vault/persistence/ports';

import { VaultRegistryModel } from './VaultRegistryModel';

function knownVault(name: string, lastOpenedAt: number | null): IKnownVault {
  return {
    vaultKey: name as TVaultKey,
    name,
    lastOpenedAt: lastOpenedAt as Milliseconds | null,
    unsyncedChanges: false,
  };
}

function registryListing(listed: Awaited<ReturnType<IVaultRegistry['list']>>): IVaultRegistry {
  return {
    list: () => Promise.resolve(listed),
    put: () => Promise.resolve(ok(undefined)),
    remove: () => Promise.resolve(ok(undefined)),
  };
}

describe('VaultRegistryModel', () => {
  it('lists the most recently opened vault first and never-opened ones last', async () => {
    const model = new VaultRegistryModel(
      registryListing(
        ok([knownVault('home', 100), knownVault('fresh', null), knownVault('work', 200)])
      )
    );

    await model.refresh();

    expect(model.vaults.value?.map(vault => vault.name)).toEqual(['work', 'home', 'fresh']);
  });

  it('keeps the reason when the device store is unavailable', async () => {
    const model = new VaultRegistryModel(registryListing(err({ kind: 'unavailable' })));

    await model.refresh();

    expect(model.vaults.fail?.code).toBe(EValueDescriptorErrorCode.UNAVAILABLE);
  });
});
