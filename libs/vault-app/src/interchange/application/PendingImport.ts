import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef } from 'mobx';

import type { IVaultFile } from '../../cloud/domain/ports/vault-file-picker';

/**
 * Where a waiting file goes: a vault this device knows, or the one about to be made — any vault
 * but those the device knew when that was chosen, so the vault still open meanwhile never takes it.
 */
export type TImportTarget =
  | { readonly kind: 'vault'; readonly vaultKey: TVaultKey }
  | { readonly kind: 'new'; readonly known: ReadonlySet<TVaultKey> };

/**
 * A file handed over that is not a vault of this app (another manager's export or database): it
 * waits here while the user picks the vault it goes into, then that vault's import takes it.
 */
export class PendingImport {
  file: IVaultFile | null = null;
  target: TImportTarget | null = null;

  constructor() {
    makeAutoObservable(this, { file: observableRef, target: observableRef }, { autoBind: true });
  }

  /** A new file asks again where it goes. */
  hold(file: IVaultFile): void {
    this.file = file;
    this.target = null;
  }

  aim(target: TImportTarget): void {
    if (!isNil(this.file)) {
      this.target = target;
    }
  }

  drop(): void {
    this.file = null;
    this.target = null;
  }

  /** The file waits for this vault: it was picked, or it was made for the file. */
  awaits(vaultKey: TVaultKey): boolean {
    const { file, target } = this;
    if (isNil(file) || isNil(target)) {
      return false;
    }
    return target.kind === 'new' ? !target.known.has(vaultKey) : target.vaultKey === vaultKey;
  }

  /** The waiting file, once, and only for the vault it waits for. */
  takeFor(vaultKey: TVaultKey): IVaultFile | null {
    if (!this.awaits(vaultKey)) {
      return null;
    }
    const { file } = this;
    this.drop();
    return file;
  }
}
