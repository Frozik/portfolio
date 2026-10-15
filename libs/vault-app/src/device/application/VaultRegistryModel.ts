import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import type { Milliseconds } from '@frozik/utils/date/types';
import type { ValueDescriptor } from '@frozik/utils/value-descriptors/types';
import {
  createSyncedValueDescriptor,
  createUnsyncedValueDescriptor,
  EMPTY_VD,
  isSyncedValueDescriptor,
} from '@frozik/utils/value-descriptors/utils';
import type { IVaultTitle } from '@frozik/vault/model/vault-settings-edits';
import type {
  IKnownVault,
  IVaultRegistry,
  TPersisted,
  TVaultKey,
} from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';

import { LOCAL_COPY_PATH } from '../../sync/domain/local-copy';
import { vaultErrorFail } from '../domain/vault-error-fail';

/** The record carrying the vault's own name and description; the same record when they already match. */
export function withTitle(entry: IKnownVault, title: IVaultTitle): IKnownVault {
  return entry.name === title.name && entry.description === title.description
    ? entry
    : { ...entry, name: title.name, description: title.description };
}

/** The vaults this device knows, newest opened first. */
export class VaultRegistryModel {
  vaults: ValueDescriptor<readonly IKnownVault[]> = EMPTY_VD;

  constructor(
    private readonly registry: IVaultRegistry,
    private readonly device: {
      readonly localCopyOf: (vaultKey: TVaultKey) => IStorageProvider;
      /** This device forgets one vault: its records and what it saw of it. */
      readonly forgetOnDevice: (vaultKey: TVaultKey) => TPersisted<void>;
    }
  ) {
    makeAutoObservable<VaultRegistryModel, 'registry' | 'device'>(
      this,
      { registry: false, device: false },
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

  /** A vault new on this device; `false` when the device could not keep it. */
  async addNew(vaultKey: TVaultKey, title: IVaultTitle, at: Milliseconds): Promise<boolean> {
    const added = await this.registry.put({
      vaultKey,
      name: title.name,
      description: title.description,
      lastOpenedAt: at,
      unsyncedChanges: false,
    });
    return added.ok;
  }

  /** The vault's own name and description, as this device lists it. */
  retitle(vaultKey: TVaultKey, title: IVaultTitle): Promise<void> {
    return this.change(vaultKey, entry => withTitle(entry, title));
  }

  /** The local copy and every record of the vault leave this device; the cloud keeps it. */
  async forget(vaultKey: TVaultKey, signal: AbortSignal): Promise<void> {
    await this.device.localCopyOf(vaultKey).remove(LOCAL_COPY_PATH, { kind: 'overwrite' }, signal);
    await this.device.forgetOnDevice(vaultKey);
    await this.refresh();
  }

  /** The list shows the vault opened last first. */
  stampOpened(vaultKey: TVaultKey, at: Milliseconds): Promise<void> {
    return this.change(vaultKey, entry => ({ ...entry, lastOpenedAt: at }));
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
