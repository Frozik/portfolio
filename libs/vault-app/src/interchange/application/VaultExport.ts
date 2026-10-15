import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import type { IVaultCodec } from '@frozik/vault/codec/vault-codec';
import { utf8 } from '@frozik/vault/crypto/bytes';
import { encodePassword } from '@frozik/vault/crypto/password-normalization';
import { exportCsv } from '@frozik/vault/export/csv/export-csv';
import type { ICxfExporter } from '@frozik/vault/export/cxf/export-cxf';
import { exportCxf } from '@frozik/vault/export/cxf/export-cxf';
import { exportOpenZip } from '@frozik/vault/export/zip/export-zip';
import { blobFileName } from '@frozik/vault/format/blob-file';
import { packContainer } from '@frozik/vault/format/container';
import { COPY_VAULT_PATH } from '@frozik/vault/format/export-archives';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { unlockFailureOf } from '@frozik/vault/session/unlock-failure';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { IReadFiles } from '../../document/application/VaultFiles';
import type { TMasterPasswordProblem } from '../../keys/domain/master-password';
import { masterPasswordProblem } from '../../keys/domain/master-password';
import { newManifest } from '../../session/domain/new-manifest';
import type { IFileToSave, TSaveFile } from '../domain/ports/file-saver';
import { exportBaseName } from './export-file-name';

/** A sealed copy with its own password, or the vault in the open. */
export type TExportFormat = 'pwv' | 'zip' | 'cxf' | 'csv';

export type TExportStep =
  | { readonly kind: 'editing'; readonly failure: TUnlockFailure | null }
  | { readonly kind: 'preparing' }
  | {
      readonly kind: 'ready';
      readonly file: IFileToSave;
      /** Blobs neither this device nor the cloud could give: the archive goes without them. */
      readonly missingFiles: number;
    }
  | { readonly kind: 'saved' };

export type TExportProblem = TMasterPasswordProblem | 'no-password';

export interface IVaultExportServices {
  readonly document: () => IVaultDocument;
  readonly codec: IVaultCodec;
  /** The master password typed again; the reason it is wrong, or `null`. */
  readonly checkPassword: (password: string) => Promise<TUnlockFailure | null>;
  readonly saveFile: TSaveFile;
  readonly now: () => number;
  /** Which client made the file, in its manifest. */
  readonly createdBy: string;
  /** Every file's bytes, the blobs read from where they are kept. */
  readonly readFiles: () => Promise<IReadFiles>;
  /** The blob files as sealed, for an encrypted copy. */
  readonly readSealedBlobs: () => Promise<IReadFiles>;
  /** Who the CXF file says made it, and the vault's id as its account. */
  readonly cxfExporter: ICxfExporter;
}

interface IPreparedFile {
  readonly file: IFileToSave;
  readonly missingFiles: number;
}

const FIRST_REVISION = 1;
/** CXF names no file of its own: the archive is a zip, and says what it holds. */
const EXTENSION: Readonly<Record<TExportFormat, string>> = {
  pwv: 'pwv',
  zip: 'zip',
  cxf: 'cxf.zip',
  csv: 'csv',
};
const COPY_ARCHIVE_EXTENSION = 'pwv.zip';

const MIME: Readonly<Record<TExportFormat, string>> = {
  pwv: 'application/octet-stream',
  zip: 'application/zip',
  cxf: 'application/zip',
  csv: 'text/csv',
};

/**
 * "Export": the sealed copy asks for a new password twice;
 * the open formats ask for the master password and a confirmation that the
 * file is not encrypted. The file is made first and saved on a second click,
 * where the save dialog may open.
 */
export class VaultExport {
  format: TExportFormat = 'pwv';
  password = '';
  confirmation = '';
  acknowledged = false;
  step: TExportStep = { kind: 'editing', failure: null };

  private readonly controller = new AbortController();

  constructor(private readonly services: IVaultExportServices) {
    makeAutoObservable<VaultExport, 'services' | 'controller'>(
      this,
      { step: observableRef, services: false, controller: false },
      { autoBind: true }
    );
  }

  get problem(): TExportProblem | null {
    if (this.format === 'pwv') {
      return masterPasswordProblem({ ...this, acknowledged: true });
    }
    if (this.password === '') {
      return 'no-password';
    }
    return this.acknowledged ? null : 'not-acknowledged';
  }

  setFormat(format: TExportFormat): void {
    this.format = format;
    this.reset();
  }

  setPassword(password: string): void {
    this.password = password;
  }

  setConfirmation(confirmation: string): void {
    this.confirmation = confirmation;
  }

  setAcknowledged(acknowledged: boolean): void {
    this.acknowledged = acknowledged;
  }

  async prepare(): Promise<void> {
    if (!isNil(this.problem) || this.step.kind === 'preparing') {
      return;
    }
    const { format, password } = this;
    this.password = '';
    this.confirmation = '';
    this.step = { kind: 'preparing' };
    const made = await this.fileOf(format, password);
    runInAction(() => {
      this.step = made.ok
        ? { kind: 'ready', ...made.value }
        : { kind: 'editing', failure: made.error };
    });
  }

  /** Must be called synchronously from a click: the save dialog opens there or not at all. */
  async save(): Promise<void> {
    const { step } = this;
    if (step.kind !== 'ready') {
      return;
    }
    const saved = await this.services.saveFile(step.file);
    if (saved === 'saved') {
      runInAction(() => {
        this.step = { kind: 'saved' };
      });
    }
  }

  reset(): void {
    this.password = '';
    this.confirmation = '';
    this.acknowledged = false;
    this.step = { kind: 'editing', failure: null };
  }

  dispose(): void {
    this.controller.abort();
  }

  private async fileOf(
    format: TExportFormat,
    password: string
  ): Promise<TResult<IPreparedFile, TUnlockFailure>> {
    const document = this.services.document();
    const file = (bytes: Uint8Array<ArrayBuffer>, missingFiles = 0): IPreparedFile => ({
      file: {
        name: `${exportBaseName(document.settings.name, this.services.now())}.${EXTENSION[format]}`,
        mime: MIME[format],
        bytes,
      },
      missingFiles,
    });
    if (format === 'pwv') {
      const sealed = await this.sealedCopy(document, password);
      return sealed.ok ? ok(await this.withBlobs(document, sealed.value, file)) : sealed;
    }
    const failure = await this.services.checkPassword(password);
    if (!isNil(failure)) {
      return err(failure);
    }
    switch (format) {
      case 'zip': {
        const files = await this.services.readFiles();
        return ok(
          file(
            exportOpenZip(
              document,
              newManifest(this.services.createdBy, this.services.now()),
              files.bytes
            ),
            files.missing
          )
        );
      }
      case 'cxf': {
        const files = await this.services.readFiles();
        const bytes = await exportCxf(
          document,
          files.bytes,
          this.services.cxfExporter,
          this.services.now()
        );
        return ok(file(bytes, files.missing));
      }
      case 'csv':
        return ok(file(utf8(exportCsv(document))));
      default:
        return assertNever(format);
    }
  }

  /**
   * A copy whose vault has big files carries them beside it in
   * a zip, sealed as they are: their keys travel only inside the copy.
   */
  private async withBlobs(
    document: IVaultDocument,
    sealed: Uint8Array<ArrayBuffer>,
    file: (bytes: Uint8Array<ArrayBuffer>) => IPreparedFile
  ): Promise<IPreparedFile> {
    if (![...document.assets.values()].some(asset => asset.storage.kind === 'blob')) {
      return file(sealed);
    }
    const blobs = await this.services.readSealedBlobs();
    const archive = packContainer([
      { path: COPY_VAULT_PATH, bytes: sealed, compress: false },
      ...[...blobs.bytes].map(([id, bytes]) => ({
        path: blobFileName(id),
        bytes,
        compress: false,
      })),
    ]);
    return {
      file: {
        name: `${exportBaseName(document.settings.name, this.services.now())}.${COPY_ARCHIVE_EXTENSION}`,
        mime: MIME.zip,
        bytes: archive,
      },
      missingFiles: blobs.missing,
    };
  }

  /** A new key, a new id and one slot: the copy shares nothing with the vault but the cards. */
  private async sealedCopy(
    document: IVaultDocument,
    password: string
  ): Promise<TResult<Uint8Array<ArrayBuffer>, TUnlockFailure>> {
    const { codec } = this.services;
    const { signal } = this.controller;
    const keys = await codec.createKeys(encodePassword(password), signal);
    if (!keys.ok) {
      return err(unlockFailureOf(keys.error));
    }
    const sealed = await codec.seal(
      { ...document, settings: { ...document.settings, providerHint: null } },
      newManifest(this.services.createdBy, this.services.now()),
      { ...keys.value, revision: FIRST_REVISION, movedTo: null },
      signal
    );
    return sealed.ok ? ok(sealed.value) : err(unlockFailureOf(sealed.error));
  }
}
