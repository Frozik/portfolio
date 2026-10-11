import type { ValueDescriptor } from '@frozik/utils/value-descriptors/types';
import {
  createSyncedValueDescriptor,
  createUnsyncedValueDescriptor,
  EMPTY_VD,
  isSyncedValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import type { IKnownVault, IVaultRegistry } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';

import { vaultErrorFail } from './vault-error-fail';

/** The vaults this device knows, newest opened first. */
export class VaultRegistryModel {
  vaults: ValueDescriptor<readonly IKnownVault[]> = EMPTY_VD;

  constructor(private readonly registry: IVaultRegistry) {
    makeAutoObservable<VaultRegistryModel, 'registry'>(
      this,
      { registry: false },
      { autoBind: true }
    );
  }

  /** This device's record of one vault, as last listed. */
  entryOf(vaultKey: string): IKnownVault | null {
    const listed = isSyncedValueDescriptor(this.vaults) ? this.vaults.value : [];
    return listed.find(vault => vault.vaultKey === vaultKey) ?? null;
  }

  /**
   * Rewrites one vault's record and lists again; a vault the device no
   * longer knows stays unknown, and an edit that changes nothing writes nothing.
   */
  async change(vaultKey: string, edit: (entry: IKnownVault) => IKnownVault): Promise<void> {
    const listed = await this.registry.list();
    const entry = listed.ok ? listed.value.find(vault => vault.vaultKey === vaultKey) : undefined;
    const next = isNil(entry) ? null : edit(entry);
    if (!isNil(next) && next !== entry) {
      await this.registry.put(next);
    }
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const listed = await this.registry.list();
    runInAction(() => {
      this.vaults = listed.ok
        ? createSyncedValueDescriptor(
            [...listed.value].sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
          )
        : createUnsyncedValueDescriptor(vaultErrorFail(listed.error));
    });
  }
}
