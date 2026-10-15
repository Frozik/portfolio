import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import type { IVaultRegistry, TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';

import type { VaultRegistryModel } from '../../device/application/VaultRegistryModel';
import type { IVaultFile, TPickVaultFile } from '../domain/ports/vault-file-picker';
import type { TAdoptFailure } from './cloud-adoption';
import { adoptVaultFile } from './cloud-adoption';

export type TFileOpening =
  | { readonly kind: 'idle' }
  | { readonly kind: 'opening' }
  | { readonly kind: 'failed'; readonly failure: TAdoptFailure };

/**
 * A `.pwv` the user picks — exported, sent, copied off a cloud by hand —
 * becomes a vault this device knows; the usual unlock opens it. It is not
 * linked to anything: a cloud is connected from the open vault.
 */
export class VaultFileOpening {
  state: TFileOpening = { kind: 'idle' };

  constructor(
    private readonly services: {
      readonly pickVaultFile: TPickVaultFile;
      readonly localCopyOf: (vaultKey: TVaultKey) => IStorageProvider;
      readonly registry: IVaultRegistry;
    },
    private readonly registry: Pick<VaultRegistryModel, 'refresh'>,
    private readonly signal: AbortSignal
  ) {
    makeAutoObservable<VaultFileOpening, 'services' | 'registry' | 'signal'>(
      this,
      { services: false, registry: false, signal: false },
      { autoBind: true }
    );
  }

  /** The vault's key once it is on this device; `null` when nothing was picked or it failed. */
  async open(): Promise<TVaultKey | null> {
    const file = await this.services.pickVaultFile();
    return isNil(file) ? null : this.adopt(file);
  }

  /** A file that came another way — dropped on the screen — taken in as one picked. */
  async adopt(file: IVaultFile): Promise<TVaultKey | null> {
    runInAction(() => {
      this.state = { kind: 'opening' };
    });
    const adopted = await adoptVaultFile(file, this.services, this.signal);
    runInAction(() => {
      this.state = adopted.ok ? { kind: 'idle' } : { kind: 'failed', failure: adopted.error };
    });
    await this.registry.refresh();
    return adopted.ok ? adopted.value : null;
  }
}
