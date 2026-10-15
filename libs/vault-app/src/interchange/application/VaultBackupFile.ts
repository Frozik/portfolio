import type { TStorageResult } from '@frozik/cloud-storage/core/storage-error';
import type { IStorageObject } from '@frozik/cloud-storage/core/storage-provider';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction, when } from 'mobx';

import type { IFileToSave, TSaveFile } from '../domain/ports/file-saver';
import { exportBaseName } from './export-file-name';

export type TBackupFileStep =
  | { readonly kind: 'idle' }
  | { readonly kind: 'preparing' }
  | { readonly kind: 'ready'; readonly file: IFileToSave }
  | { readonly kind: 'saved' }
  | { readonly kind: 'unreadable' };

export interface IVaultBackupFileServices {
  /** Every edit so far is in this device's copy of the file. */
  readonly settled: () => boolean;
  readonly readLocalFile: (signal: AbortSignal) => Promise<TStorageResult<IStorageObject | null>>;
  readonly saveFile: TSaveFile;
  readonly vaultName: () => string;
  readonly now: () => number;
  /** Attachments kept beside the vault file, which this copy does not carry. */
  readonly hasBigFiles: () => boolean;
}

const MIME = 'application/octet-stream';

/**
 * The vault file itself, saved where the user chooses: the same vault under the same password,
 * so opening it on any device brings this vault back rather than a copy of it. The file is made
 * first and saved on a second click, which the save dialog needs to come straight from.
 */
export class VaultBackupFile {
  step: TBackupFileStep = { kind: 'idle' };

  private readonly controller = new AbortController();

  constructor(private readonly services: IVaultBackupFileServices) {
    makeAutoObservable<VaultBackupFile, 'services' | 'controller'>(
      this,
      { step: observableRef, services: false, controller: false },
      { autoBind: true }
    );
  }

  get leavesOutBigFiles(): boolean {
    return this.services.hasBigFiles();
  }

  async prepare(): Promise<void> {
    if (this.step.kind === 'preparing') {
      return;
    }
    this.step = { kind: 'preparing' };
    const { signal } = this.controller;
    await when(this.services.settled, { signal });
    const read = await this.services.readLocalFile(signal);
    runInAction(() => {
      this.step =
        read.ok && !isNil(read.value)
          ? {
              kind: 'ready',
              file: {
                name: `${exportBaseName(this.services.vaultName(), this.services.now())}.pwv`,
                mime: MIME,
                bytes: read.value.bytes,
              },
            }
          : { kind: 'unreadable' };
    });
  }

  async save(): Promise<void> {
    const { step } = this;
    if (step.kind !== 'ready') {
      return;
    }
    const saved = await this.services.saveFile(step.file);
    runInAction(() => {
      if (saved === 'saved') {
        this.step = { kind: 'saved' };
      }
    });
  }

  reset(): void {
    this.step = { kind: 'idle' };
  }

  dispose(): void {
    this.controller.abort();
  }
}
