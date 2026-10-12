import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import type { IStorageProvider, TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
import type { TDriveSpace } from '@frozik/cloud-storage/google-drive/drive-space';
import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import { bytesEqual } from '@frozik/vault/crypto/bytes';
import {
  DRIVE_VAULT_FOLDER,
  driveFolderOf,
  isVaultFile,
} from '@frozik/vault/format/cloud-file-names';
import { decodeHeader } from '@frozik/vault/format/header';
import type { ISealedJsonRecord } from '@frozik/vault/session/sealed-json-record';
import { createSealedJsonRecord } from '@frozik/vault/session/sealed-json-record';
import { vaultKeyOf } from '@frozik/vault/session/vault-key-of';
import { isNil } from 'lodash-es';

import type { TCloudLink, TConnectOutcome, TDriveSearch, TPullOutcome } from '../domain/cloud';
import { CLOUD_LINK_SCHEMA } from '../domain/cloud';
import type { IExtensionServices, ISetup } from '../domain/ports';

/** The copy the extension keeps, in its own IndexedDB. */
export const LOCAL_COPY = storagePath('vault.pwv');
const CLOUD_LINK_RECORD = 'cloud-link';
const SIGNAL = new AbortController().signal;
const PATH_SEPARATOR = '/';

function keyIdOfFile(file: TBytes): TBytes | null {
  const decoded = decodeHeader(file);
  return decoded.ok ? decoded.value.header.keyId : null;
}

function fileOf(link: TCloudLink): TStoragePath {
  switch (link.kind) {
    case 'webdav':
      return storagePath(link.source.fileName);
    case 'google-drive':
      return storagePath(link.source.path);
    default:
      return assertNever(link);
  }
}

/** The vault's name before it is unlocked: its file's, without the extension. */
function nameOf(link: TCloudLink): string {
  return (fileOf(link).split(PATH_SEPARATOR).at(-1) ?? '').replace(/\.pwv$/i, '');
}

/**
 * The extension's tie to the vault in a WebDAV folder or in Google Drive:
 * read-only. The file is fetched at setup and pulled again while unlocked;
 * the cloud is the truth, so a newer file simply replaces the copy. Where
 * the file is and how to reach it are sealed with the vault's key: before
 * the unlock the extension shows only the vault's name.
 */
export class CloudCopy {
  constructor(private readonly services: IExtensionServices) {}

  async connect(link: TCloudLink): Promise<TConnectOutcome> {
    const read = await this.storageOf(link).read(fileOf(link), SIGNAL);
    if (!read.ok) {
      return read.error.kind === 'auth-required' ? 'signed-out' : 'unreachable';
    }
    if (isNil(read.value)) {
      return 'not-found';
    }
    const { bytes, stat } = read.value;
    const vaultKey = vaultKeyOf(bytes);
    if (isNil(vaultKey)) {
      return 'not-a-vault';
    }
    const written = await this.services
      .localCopyOf(vaultKey)
      .write(LOCAL_COPY, bytes, { kind: 'overwrite' }, SIGNAL);
    if (!written.ok) {
      return 'unreachable';
    }
    await this.services.sessionKeys.clear();
    await this.services.pendingLink.save(link);
    await this.services.setup.save({ vaultKey, name: nameOf(link), cloudRev: stat.rev });
    return 'connected';
  }

  /** Google's sign-in, then the vault files in the folder; the hidden space keeps them in its own. */
  async findDriveVaults(space: TDriveSpace, folder: string): Promise<TDriveSearch> {
    const path = space === 'my-drive' ? driveFolderOf(folder) : DRIVE_VAULT_FOLDER;
    if (isNil(path)) {
      return { kind: 'failed', reason: 'unreachable', detail: null };
    }
    const signedIn = await this.services.googleDrive.signIn(space, null);
    if (!signedIn.ok) {
      return { kind: 'failed', reason: signedIn.error.kind, detail: signedIn.error.detail };
    }
    const listed = await this.services.googleDrive.open(space, signedIn.value).list(path, SIGNAL);
    return listed.ok
      ? {
          kind: 'found',
          space,
          account: signedIn.value,
          paths: listed.value.filter(stat => isVaultFile(stat.path)).map(stat => stat.path),
        }
      : { kind: 'failed', reason: 'unreachable', detail: listed.error.kind };
  }

  /** A vault chosen from disk has no cloud: the link of the one before goes. */
  async forget(vaultKey: string): Promise<void> {
    await this.services.pendingLink.clear();
    await this.services.deviceConfig.delete(vaultKey, CLOUD_LINK_RECORD);
  }

  /** The link given at setup, or kept over a key rotation, sealed under the vault's key once it is unlocked. */
  async sealPendingLink(vaultKey: string, dek: CryptoKey): Promise<void> {
    const pending = await this.services.pendingLink.load();
    if (isNil(pending)) {
      return;
    }
    await this.linkRecord(vaultKey, dek).save(pending);
    await this.services.pendingLink.clear();
  }

  async pull(
    setup: ISetup,
    session: { readonly dek: CryptoKey; readonly keyId: TBytes }
  ): Promise<TPullOutcome> {
    const link = await this.linkOf(setup, session);
    if (isNil(link)) {
      return 'no-cloud';
    }
    const storage = this.storageOf(link);
    const path = fileOf(link);
    const stat = await storage.stat(path, SIGNAL);
    if (!stat.ok) {
      return stat.error.kind === 'auth-required' ? 'signed-out' : 'unreachable';
    }
    if (isNil(stat.value)) {
      return 'unreachable';
    }
    if (stat.value.rev === setup.cloudRev) {
      return 'unchanged';
    }
    const read = await storage.read(path, SIGNAL);
    if (!read.ok || isNil(read.value) || vaultKeyOf(read.value.bytes) !== setup.vaultKey) {
      return 'unreachable';
    }
    await this.services
      .localCopyOf(setup.vaultKey)
      .write(LOCAL_COPY, read.value.bytes, { kind: 'overwrite' }, SIGNAL);
    await this.services.setup.save({ ...setup, cloudRev: read.value.stat.rev });
    const keyId = keyIdOfFile(read.value.bytes);
    if (!isNil(keyId) && bytesEqual(keyId, session.keyId)) {
      return 'updated';
    }
    await this.services.pendingLink.save(link);
    return 'rotated';
  }

  /** Google's window again for the account the vault was reached with, then the pull it held up. */
  async signInAgain(
    setup: ISetup,
    session: { readonly dek: CryptoKey; readonly keyId: TBytes }
  ): Promise<TPullOutcome> {
    const link = await this.linkOf(setup, session);
    if (link?.kind !== 'google-drive') {
      return 'no-cloud';
    }
    const signedIn = await this.services.googleDrive.signIn(link.source.space, link.source.account);
    return signedIn.ok ? this.pull(setup, session) : 'signed-out';
  }

  private async linkOf(
    setup: ISetup,
    session: { readonly dek: CryptoKey }
  ): Promise<TCloudLink | null> {
    return (
      (await this.linkRecord(setup.vaultKey, session.dek).load()) ??
      (await this.services.pendingLink.load())
    );
  }

  private storageOf(link: TCloudLink): IStorageProvider {
    switch (link.kind) {
      case 'webdav':
        return this.services.openWebDav(link.source, link.password);
      case 'google-drive':
        return this.services.googleDrive.open(link.source.space, link.source.account);
      default:
        return assertNever(link);
    }
  }

  private linkRecord(vaultKey: string, dek: CryptoKey): ISealedJsonRecord<TCloudLink> {
    return createSealedJsonRecord({
      store: this.services.deviceConfig,
      vaultKey,
      recordKey: CLOUD_LINK_RECORD,
      dek,
      label: 'pwv/device-config',
      random: this.services.random,
      decode: value => {
        const parsed = CLOUD_LINK_SCHEMA.safeParse(value);
        return parsed.success ? parsed.data : null;
      },
    });
  }
}
