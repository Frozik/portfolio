import type { TStorageResult } from '@frozik/cloud-storage/core/storage-error';
import type { IStorageObject } from '@frozik/cloud-storage/core/storage-provider';
import type { Milliseconds } from '@frozik/utils/date/types';
import { isNil, orderBy } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction, when } from 'mobx';

import type { DeviceSettingsModel } from '../../device/application/DeviceSettingsModel';
import type { TBackupInterval } from '../../device/domain/backup-interval';
import { isBackupDue } from '../../device/domain/backup-interval';
import type { IBackupFileEntry, IBackupFolder } from '../domain/ports/backup-folder';
import type { TSaveFile } from '../domain/ports/file-saver';
import { backupFileName } from './export-file-name';

const MIME = 'application/octet-stream';

export type TBackupListing =
  | { readonly kind: 'loading' }
  | { readonly kind: 'listed'; readonly files: readonly IBackupFileEntry[] }
  | { readonly kind: 'unavailable' };

export type TBackupMaking =
  | { readonly kind: 'idle' }
  | { readonly kind: 'making' }
  | { readonly kind: 'made'; readonly name: string }
  | { readonly kind: 'failed' };

export interface IVaultBackupFolderServices {
  readonly folder: IBackupFolder;
  /** Every edit so far is in this device's copy of the file. */
  readonly settled: () => boolean;
  readonly readLocalFile: (signal: AbortSignal) => Promise<TStorageResult<IStorageObject | null>>;
  readonly saveFile: TSaveFile;
  readonly vaultName: () => string;
  readonly now: () => number;
  /** Attachments kept beside the vault file, which a copy does not carry. */
  readonly hasBigFiles: () => boolean;
  readonly settings: Pick<DeviceSettingsModel, 'settings' | 'update' | 'loaded'>;
}

/**
 * Copies of the vault file in a folder on this device: made now or once the chosen number of days
 * has passed, listed newest first, shared to another app or deleted. A copy is the vault itself
 * under its own password, so opening it brings this vault back.
 */
export class VaultBackupFolder {
  listing: TBackupListing = { kind: 'loading' };
  making: TBackupMaking = { kind: 'idle' };

  private readonly controller = new AbortController();

  constructor(private readonly services: IVaultBackupFolderServices) {
    makeAutoObservable<VaultBackupFolder, 'services' | 'controller'>(
      this,
      { listing: observableRef, making: observableRef, services: false, controller: false },
      { autoBind: true }
    );
  }

  get location(): string {
    return this.services.folder.location;
  }

  get interval(): TBackupInterval {
    return this.services.settings.settings.backupEveryDays;
  }

  get lastBackupAt(): number | null {
    return this.services.settings.settings.lastBackupAt;
  }

  get leavesOutBigFiles(): boolean {
    return this.services.hasBigFiles();
  }

  setInterval(interval: TBackupInterval): void {
    this.services.settings.update({ backupEveryDays: interval });
  }

  async refresh(): Promise<void> {
    const files = await this.services.folder.list();
    runInAction(() => {
      this.listing = isNil(files)
        ? { kind: 'unavailable' }
        : { kind: 'listed', files: orderBy(files, file => file.modifiedAt, 'desc') };
    });
  }

  /** At unlock: a copy once the chosen number of days has passed since the last one. */
  async backUpIfDue(): Promise<void> {
    await this.services.settings.loaded();
    if (isBackupDue(this.interval, this.lastBackupAt, this.services.now())) {
      await this.backUpNow();
    }
  }

  async backUpNow(): Promise<void> {
    if (this.making.kind === 'making') {
      return;
    }
    this.making = { kind: 'making' };
    const { signal } = this.controller;
    const { folder, settled, readLocalFile, vaultName, now, settings } = this.services;
    const ready = await when(settled, { signal }).then(
      () => true,
      () => false
    );
    if (!ready) {
      runInAction(() => {
        this.making = { kind: 'idle' };
      });
      return;
    }
    const read = await readLocalFile(signal);
    const at = now();
    const name = backupFileName(vaultName(), at);
    const written = read.ok && !isNil(read.value) && (await folder.write(name, read.value.bytes));
    if (written) {
      settings.update({ lastBackupAt: at as Milliseconds });
    }
    runInAction(() => {
      this.making = written ? { kind: 'made', name } : { kind: 'failed' };
    });
    await this.refresh();
  }

  async remove(name: string): Promise<void> {
    await this.services.folder.remove(name);
    await this.refresh();
  }

  /** A copy goes to another app through the share sheet: a messenger, the mail, Drive. */
  async share(name: string): Promise<void> {
    const bytes = await this.services.folder.read(name);
    if (!isNil(bytes)) {
      await this.services.saveFile({ name, mime: MIME, bytes });
    }
  }

  dispose(): void {
    this.controller.abort();
  }
}
