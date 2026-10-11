import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import { bytesEqual } from '@frozik/vault/crypto/bytes';
import { decodeHeader } from '@frozik/vault/format/header';
import type { ISealedJsonRecord } from '@frozik/vault/session/sealed-json-record';
import { createSealedJsonRecord } from '@frozik/vault/session/sealed-json-record';
import { vaultKeyOf } from '@frozik/vault/session/vault-key-of';
import { isNil } from 'lodash-es';
import { z } from 'zod';

import type { IWebDavLink, IWebDavSource, TConnectOutcome, TPullOutcome } from '../domain/cloud';
import type { IExtensionServices, ISetup } from '../domain/ports';

/** The copy the extension keeps, in its own IndexedDB. */
export const LOCAL_COPY = storagePath('vault.pwv');
const WEBDAV_LINK_RECORD = 'webdav-link';
const SIGNAL = new AbortController().signal;

const WEBDAV_LINK_SCHEMA = z.object({
  source: z.object({ folderUrl: z.string(), username: z.string(), fileName: z.string() }),
  password: z.string().min(1),
});

function keyIdOfFile(file: TBytes): TBytes | null {
  const decoded = decodeHeader(file);
  return decoded.ok ? decoded.value.header.keyId : null;
}

/**
 * The extension's tie to the vault in a WebDAV folder:
 * read-only. The file is fetched at setup and pulled again while unlocked;
 * the cloud is the truth, so a newer file simply replaces the copy. Where
 * the folder is and its password are sealed with the vault's key: before
 * the unlock the extension shows only the vault's name.
 */
export class CloudCopy {
  constructor(private readonly services: IExtensionServices) {}

  async connect(source: IWebDavSource, password: string): Promise<TConnectOutcome> {
    const read = await this.services
      .openWebDav(source, password)
      .read(storagePath(source.fileName), SIGNAL);
    if (!read.ok) {
      return 'unreachable';
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
    await this.services.pendingWebDavLink.save({ source, password });
    await this.services.setup.save({
      vaultKey,
      name: source.fileName.replace(/\.pwv$/i, ''),
      cloudRev: stat.rev,
    });
    return 'connected';
  }

  /** A vault chosen from disk has no folder: the link of the one before goes. */
  async forget(vaultKey: string): Promise<void> {
    await this.services.pendingWebDavLink.clear();
    await this.services.deviceConfig.delete(vaultKey, WEBDAV_LINK_RECORD);
  }

  /** The link typed at setup, or kept over a key rotation, sealed under the vault's key once it is unlocked. */
  async sealPendingLink(vaultKey: string, dek: CryptoKey): Promise<void> {
    const pending = await this.services.pendingWebDavLink.load();
    if (isNil(pending)) {
      return;
    }
    await this.linkRecord(vaultKey, dek).save(pending);
    await this.services.pendingWebDavLink.clear();
  }

  async pull(
    setup: ISetup,
    session: { readonly dek: CryptoKey; readonly keyId: TBytes }
  ): Promise<TPullOutcome> {
    const link =
      (await this.linkRecord(setup.vaultKey, session.dek).load()) ??
      (await this.services.pendingWebDavLink.load());
    if (isNil(link)) {
      return 'no-cloud';
    }
    const { source, password } = link;
    const storage = this.services.openWebDav(source, password);
    const path = storagePath(source.fileName);
    const stat = await storage.stat(path, SIGNAL);
    if (!stat.ok || isNil(stat.value)) {
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
    await this.services.pendingWebDavLink.save(link);
    return 'rotated';
  }

  private linkRecord(vaultKey: string, dek: CryptoKey): ISealedJsonRecord<IWebDavLink> {
    return createSealedJsonRecord({
      store: this.services.deviceConfig,
      vaultKey,
      recordKey: WEBDAV_LINK_RECORD,
      dek,
      label: 'pwv/device-config',
      random: this.services.random,
      decode: value => {
        const parsed = WEBDAV_LINK_SCHEMA.safeParse(value);
        return parsed.success ? parsed.data : null;
      },
    });
  }
}
