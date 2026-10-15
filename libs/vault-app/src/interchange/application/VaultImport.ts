import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import type { IVaultCodec } from '@frozik/vault/codec/vault-codec';
import { encodePassword } from '@frozik/vault/crypto/password-normalization';
import type { IImportOutcome, TDuplicatePolicy } from '@frozik/vault/import/apply-import';
import { applyImport } from '@frozik/vault/import/apply-import';
import type { IPlacedBlob } from '@frozik/vault/import/blob-placement';
import { blobsToPlace } from '@frozik/vault/import/blob-placement';
import type { IImportBatch } from '@frozik/vault/import/imported-card';
import type { TKdbxError } from '@frozik/vault/import/kdbx/read-kdbx';
import type { IImportPreview } from '@frozik/vault/import/preview-import';
import { previewImport } from '@frozik/vault/import/preview-import';
import { importVaultDocument } from '@frozik/vault/import/pwv/import-vault';
import type { TImportFileError } from '@frozik/vault/import/read-import-file';
import { readImportFile } from '@frozik/vault/import/read-import-file';
import type { TSafeInCloudDbError } from '@frozik/vault/import/safeincloud/read-safeincloud-db';
import { readSafeInCloudDb } from '@frozik/vault/import/safeincloud/read-safeincloud-db';
import { verifiedFiles } from '@frozik/vault/import/verify-files';
import type { TTranslate } from '@frozik/vault/model/card-edits';
import type { TAssetId } from '@frozik/vault/model/ids';
import { newAssetId } from '@frozik/vault/model/ids';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import type { IRandom } from '@frozik/vault/ports/random';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { unlockFailureOf } from '@frozik/vault/session/unlock-failure';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { TTransact } from '../../document/application/transact';
import type { TReadQrCode } from '../../document/domain/ports/qr-reader';
import type { TReadKdbx } from '../domain/ports/kdbx-reader';

export type TImportStep =
  | { readonly kind: 'choosing' }
  | { readonly kind: 'failed'; readonly error: TImportFileError | 'read-only' | 'no-qr-code' }
  /** Another vault, a KeePass or a SafeInCloud database: its password opens it here and is forgotten. */
  | {
      readonly kind: 'vault-password';
      readonly source: TLockedSource;
      readonly opening: boolean;
      readonly failure: TUnlockFailure | null;
    }
  | {
      readonly kind: 'preview';
      readonly batch: IImportBatch;
      readonly preview: IImportPreview;
      /** Big files are being sealed beside the vault; the edit follows. */
      readonly importing: boolean;
    }
  | { readonly kind: 'done'; readonly outcome: IImportOutcome };

/** A file that opens with a password: a vault (a copy may bring its big files sealed), a KeePass or a SafeInCloud database. */
export type TLockedSource =
  | {
      readonly format: 'pwv';
      readonly vault: Uint8Array<ArrayBuffer>;
      readonly sealedBlobs: ReadonlyMap<string, Uint8Array<ArrayBuffer>>;
    }
  | { readonly format: 'kdbx'; readonly file: Uint8Array<ArrayBuffer> }
  | { readonly format: 'safeincloud'; readonly file: Uint8Array<ArrayBuffer> };

/** Another manager's file that does not open is told as a vault that does not: the same words on the same screen. */
const FOREIGN_FAILURE: Readonly<Record<TKdbxError | TSafeInCloudDbError, TUnlockFailure>> = {
  'wrong-password': 'wrong-password',
  unreadable: 'corrupted',
};

export interface IVaultImportServices {
  readonly document: () => IVaultDocument;
  readonly transact: TTransact;
  readonly codec: IVaultCodec;
  readonly random: IRandom;
  readonly translate: TTranslate;
  readonly readQrCode: TReadQrCode;
  readonly readKdbx: TReadKdbx;
  /** Seals a file beside the vault under the given id; its key in hex, `null` when not written. */
  readonly storeBlob: (assetId: TAssetId, bytes: Uint8Array<ArrayBuffer>) => Promise<string | null>;
}

/**
 * Choose a file → (its password, for a vault) → preview
 * with the duplicate choice → one edit of the document. Nothing is written
 * before the confirmation.
 */
export class VaultImport {
  step: TImportStep = { kind: 'choosing' };
  vaultPassword = '';
  /** A KeePass key file, when the database needs one: kept until the file opens or the import starts over. */
  keyFile: { readonly name: string; readonly bytes: Uint8Array<ArrayBuffer> } | null = null;
  duplicates: TDuplicatePolicy = 'skip';

  private readonly controller = new AbortController();

  constructor(private readonly services: IVaultImportServices) {
    makeAutoObservable<VaultImport, 'services' | 'controller'>(
      this,
      { step: observableRef, keyFile: observableRef, services: false, controller: false },
      { autoBind: true }
    );
  }

  async choose(bytes: Uint8Array<ArrayBuffer>): Promise<void> {
    const read = readImportFile(bytes);
    if (!read.ok) {
      this.step = { kind: 'failed', error: read.error };
      return;
    }
    const locked = (source: TLockedSource): TImportStep => ({
      kind: 'vault-password',
      source,
      opening: false,
      failure: null,
    });
    switch (read.value.kind) {
      case 'vault-file': {
        const { vault, sealedBlobs } = read.value;
        this.step = locked({ format: 'pwv', vault, sealedBlobs });
        return;
      }
      case 'kdbx-file':
        this.step = locked({ format: 'kdbx', file: bytes });
        return;
      case 'safeincloud-file':
        this.step = locked({ format: 'safeincloud', file: bytes });
        return;
      case 'entries':
        await this.showPreview(read.value.batch, this.step);
        return;
      default:
        assertNever(read.value);
    }
  }

  /** A picture of Google Authenticator's transfer QR: its text is read like any export. */
  async chooseImage(image: Parameters<TReadQrCode>[0]): Promise<void> {
    const text = await this.services.readQrCode(image);
    if (isNil(text)) {
      runInAction(() => {
        this.step = { kind: 'failed', error: 'no-qr-code' };
      });
      return;
    }
    await this.choose(new TextEncoder().encode(text));
  }

  setVaultPassword(password: string): void {
    this.vaultPassword = password;
  }

  setKeyFile(
    keyFile: { readonly name: string; readonly bytes: Uint8Array<ArrayBuffer> } | null
  ): void {
    this.keyFile = keyFile;
  }

  /** A vault needs its password; a KeePass database its password, its key file or both. */
  get canOpen(): boolean {
    const { step } = this;
    if (step.kind !== 'vault-password' || step.opening) {
      return false;
    }
    return this.vaultPassword !== '' || (step.source.format === 'kdbx' && !isNil(this.keyFile));
  }

  async openVaultFile(): Promise<void> {
    const { step } = this;
    if (step.kind !== 'vault-password' || !this.canOpen) {
      return;
    }
    const opening: TImportStep = { ...step, opening: true, failure: null };
    this.step = opening;
    const read = await this.batchOf(step.source, this.vaultPassword);
    if (this.step !== opening) {
      return;
    }
    if (!read.ok) {
      runInAction(() => {
        this.step = { ...step, opening: false, failure: read.error };
      });
      return;
    }
    runInAction(() => {
      this.vaultPassword = '';
      this.keyFile = null;
    });
    await this.showPreview(read.value, opening);
  }

  private async batchOf(
    source: TLockedSource,
    password: string
  ): Promise<TResult<IImportBatch, TUnlockFailure>> {
    if (source.format === 'kdbx') {
      const read = await this.services.readKdbx(source.file, {
        password,
        keyFile: this.keyFile?.bytes ?? null,
      });
      return read.ok ? read : err(FOREIGN_FAILURE[read.error]);
    }
    if (source.format === 'safeincloud') {
      const read = await readSafeInCloudDb(source.file, password);
      return read.ok ? read : err(FOREIGN_FAILURE[read.error]);
    }
    const opened = await this.services.codec.open(
      source.vault,
      { kind: 'password', password: encodePassword(password) },
      this.controller.signal
    );
    return opened.ok
      ? ok(await importVaultDocument(opened.value.document, source.sealedBlobs))
      : err(unlockFailureOf(opened.error));
  }

  setDuplicates(duplicates: TDuplicatePolicy): void {
    this.duplicates = duplicates;
  }

  /** Files too big for the container are sealed beside it first, then one edit brings everything. */
  async confirm(): Promise<void> {
    const { step } = this;
    if (step.kind !== 'preview' || step.importing) {
      return;
    }
    const importing: TImportStep = { ...step, importing: true };
    this.step = importing;
    let blobs: ReadonlyMap<TAssetId, IPlacedBlob> | null = null;
    try {
      blobs = await this.placeBlobs(step.batch);
    } finally {
      runInAction(() => {
        if (this.step === importing && isNil(blobs)) {
          this.step = step;
        }
      });
    }
    runInAction(() => {
      if (this.step !== importing) {
        return;
      }
      const { random, translate } = this.services;
      const context = { random, translate, duplicates: this.duplicates, blobs };
      const outcome = this.services.transact((document, at) =>
        applyImport(document, step.batch, context, at)
      );
      this.step = isNil(outcome)
        ? { kind: 'failed', error: 'read-only' }
        : { kind: 'done', outcome };
    });
  }

  private async placeBlobs(batch: IImportBatch): Promise<ReadonlyMap<TAssetId, IPlacedBlob>> {
    const placed = new Map<TAssetId, IPlacedBlob>();
    for (const source of blobsToPlace(this.services.document(), batch)) {
      const id = newAssetId(this.services.random);
      const blobKey = await this.services.storeBlob(id, source.bytes);
      if (!isNil(blobKey)) {
        placed.set(source.asset.id, { id, blobKey });
      }
    }
    return placed;
  }

  reset(): void {
    this.step = { kind: 'choosing' };
    this.vaultPassword = '';
    this.keyFile = null;
  }

  dispose(): void {
    this.controller.abort();
  }

  /**
   * The files' hashes are checked before anything is shown:
   * the preview counts what will come. A screen left meanwhile stays left.
   */
  private async showPreview(source: IImportBatch, from: TImportStep): Promise<void> {
    const batch = await verifiedFiles(source);
    const { random, translate } = this.services;
    runInAction(() => {
      if (this.step !== from) {
        return;
      }
      this.step = {
        kind: 'preview',
        batch,
        preview: previewImport(this.services.document(), batch, { random, translate }),
        importing: false,
      };
    });
  }
}
