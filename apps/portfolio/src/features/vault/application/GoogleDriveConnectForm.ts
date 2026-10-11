import type { TStorageError } from '@frozik/cloud-storage/core/storage-error';
import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import type { IStorageObjectStat, TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
import type { TDriveSpace } from '@frozik/cloud-storage/google-drive/drive-space';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import { DRIVE_VAULT_FOLDER, isVaultFile } from '../domain/cloud-files';
import type { ICloudConnection } from '../domain/ports/cloud';
import type {
  IGoogleDrive,
  TGoogleAuthFailure,
  TOpenGoogleDrive,
} from '../domain/ports/google-drive';

export type TDriveConnectFailure =
  | { readonly kind: 'auth'; readonly reason: TGoogleAuthFailure }
  | { readonly kind: 'storage'; readonly error: TStorageError };

export type TDriveCheck =
  | { readonly kind: 'unchecked' }
  | { readonly kind: 'signing-in' }
  | { readonly kind: 'looking' }
  | { readonly kind: 'found'; readonly vaults: readonly IStorageObjectStat[] }
  | { readonly kind: 'failed'; readonly failure: TDriveConnectFailure };

const UNCHECKED: TDriveCheck = { kind: 'unchecked' };

/**
 * Which Drive space, then
 * "Sign in with Google" (the popup opens inside that click) and a look into
 * the `Vault` folder there: the vaults already in it, or none yet.
 */
export class GoogleDriveConnectForm {
  space: TDriveSpace = 'my-drive';
  ready = false;
  check: TDriveCheck = UNCHECKED;

  private drive: IGoogleDrive;
  private controller = new AbortController();

  constructor(private readonly openDrive: TOpenGoogleDrive) {
    this.drive = openDrive(this.space);
    makeAutoObservable<GoogleDriveConnectForm, 'openDrive' | 'drive' | 'controller'>(
      this,
      { check: observableRef, openDrive: false, drive: false, controller: false },
      { autoBind: true }
    );
    void this.prepare();
  }

  setSpace(space: TDriveSpace): void {
    if (space === this.space) {
      return;
    }
    this.restart();
    this.space = space;
    this.drive = this.openDrive(space);
    void this.prepare();
  }

  /** Call from the click itself: the sign-in popup is opened before the first `await`. */
  async connect(): Promise<void> {
    if (!this.ready) {
      return;
    }
    this.restart();
    const { signal } = this.controller;
    const authorizing = this.drive.auth.authorize();
    this.check = { kind: 'signing-in' };
    const authorized = await authorizing;
    if (signal.aborted) {
      return;
    }
    if (!authorized.ok) {
      this.settle({ kind: 'failed', failure: { kind: 'auth', reason: authorized.error } });
      return;
    }
    this.settle({ kind: 'looking' });
    const listed = await this.drive.storage.list(DRIVE_VAULT_FOLDER, signal);
    if (signal.aborted) {
      return;
    }
    this.settle(
      listed.ok
        ? { kind: 'found', vaults: listed.value.filter(stat => isVaultFile(stat.path)) }
        : { kind: 'failed', failure: { kind: 'storage', error: listed.error } }
    );
  }

  /** The signed-in Drive with the vault's file in its `Vault` folder; `null` until signed in. */
  connectionFor(fileName: string): ICloudConnection | null {
    return this.connectionAt(storagePath(`${DRIVE_VAULT_FOLDER}/${fileName}`));
  }

  /** The signed-in Drive at a path the check found or the vault will take; `null` until signed in. */
  connectionAt(path: TStoragePath): ICloudConnection | null {
    if (this.check.kind !== 'found') {
      return null;
    }
    return {
      location: { kind: 'google-drive', space: this.space, path },
      storage: this.drive.storage,
      googleAuth: this.drive.auth,
    };
  }

  dispose(): void {
    this.controller.abort();
  }

  private async prepare(): Promise<void> {
    const drive = this.drive;
    this.ready = false;
    const ready = await drive.auth.prepare();
    runInAction(() => {
      if (drive === this.drive) {
        this.ready = ready;
      }
    });
  }

  private settle(check: TDriveCheck): void {
    this.check = check;
  }

  private restart(): void {
    this.controller.abort();
    this.controller = new AbortController();
    this.check = UNCHECKED;
  }
}
