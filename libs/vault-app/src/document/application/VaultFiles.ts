import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import type { IStorageProvider, TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import { fromHexBytes, toHex } from '@frozik/vault/crypto/bytes';
import {
  BLOB_EXTENSION,
  BLOB_FOLDER,
  blobFileName,
  newBlobKey,
  openBlob,
  sealBlob,
} from '@frozik/vault/format/blob-file';
import { ORPHAN_RETENTION_MS } from '@frozik/vault/model/asset-edits';
import type { TAssetId } from '@frozik/vault/model/ids';
import type { IAsset, IVaultDocument } from '@frozik/vault/model/vault-document';
import type { IRandom } from '@frozik/vault/ports/random';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observable, runInAction } from 'mobx';

function folderOf(vaultPath: string): string {
  const slash = vaultPath.lastIndexOf('/');
  return slash < 0 ? '' : vaultPath.slice(0, slash + 1);
}

/** `blobs/<assetId>.pwb` next to the vault file, in its folder. */
export function blobPathBeside(vaultPath: string, assetId: TAssetId): TStoragePath {
  return storagePath(`${folderOf(vaultPath)}${blobFileName(assetId)}`);
}

/** The asset id a blob file is named by; `null` for anything else in the folder. */
function blobIdOf(path: string): string | null {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return name.endsWith(BLOB_EXTENSION) ? name.slice(0, -BLOB_EXTENSION.length) : null;
}

export interface IVaultFilesServices {
  readonly document: () => IVaultDocument;
  /** The device's store of this vault: the local copy, and its blobs beside it. */
  readonly localCopy: IStorageProvider;
  readonly localPath: TStoragePath;
  /** The cloud this tab syncs with and the vault file's path there; `null` while it does not. */
  readonly cloud: () => { readonly storage: IStorageProvider; readonly path: string } | null;
  readonly random: IRandom;
  readonly signal: AbortSignal;
  readonly now: () => number;
  /**
   * When the local copy this session opened was written: a blob written since
   * may be named by a version another tab saved after this one was read.
   */
  readonly openedCopyModifiedAt: number;
}

/** A file as the view can show it: here, on its way, not to be had, or not asked for yet. */
export interface IReadFiles {
  readonly bytes: ReadonlyMap<TAssetId, TBytes>;
  readonly missing: number;
}

export type TFileState =
  | { readonly kind: 'ready'; readonly bytes: TBytes }
  | { readonly kind: 'loading' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'idle' };

const LOADING: TFileState = { kind: 'loading' };
const MISSING: TFileState = { kind: 'missing' };
const IDLE: TFileState = { kind: 'idle' };

/**
 * Files too big for the container: sealed one by one under
 * keys the container keeps, written beside the local copy at once and to the
 * cloud after a sync, read back on demand — this device's copy first, the
 * cloud's when it has none — and kept in memory for the session.
 */
export class VaultFiles {
  private readonly loaded = observable.map<TAssetId, TBytes>([], { deep: false });
  private readonly pending = observable.map<TAssetId, 'loading' | 'missing'>();
  /** Blobs this session knows the cloud has: asked once each, uploaded when missing. */
  private readonly inCloud = new Set<TAssetId>();
  /** Blobs sealed in this session: written before the document names them, never taken for leftovers. */
  private readonly storedHere = new Set<string>();
  private uploads: Promise<void> = Promise.resolve();
  /** The cloud's leftovers are cleared once a session. */
  private cloudCollected = false;

  constructor(private readonly services: IVaultFilesServices) {
    makeAutoObservable<
      VaultFiles,
      'services' | 'loaded' | 'pending' | 'inCloud' | 'storedHere' | 'uploads' | 'cloudCollected'
    >(
      this,
      {
        services: false,
        loaded: false,
        pending: false,
        inCloud: false,
        storedHere: false,
        uploads: false,
        cloudCollected: false,
      },
      { autoBind: true }
    );
  }

  fileOf(assetId: TAssetId): TFileState {
    const document = this.services.document();
    const asset = document.assets.get(assetId);
    if (isNil(asset)) {
      return MISSING;
    }
    const bytes = document.assetBytes.get(assetId) ?? this.loaded.get(assetId);
    if (!isNil(bytes)) {
      return { kind: 'ready', bytes };
    }
    if (asset.storage.kind === 'inline') {
      return MISSING;
    }
    switch (this.pending.get(assetId)) {
      case 'loading':
        return LOADING;
      case 'missing':
        return MISSING;
      default:
        return IDLE;
    }
  }

  /** After a sync the blobs not found before are looked for again: they may have arrived. */
  retryMissing(): void {
    for (const [assetId, state] of this.pending) {
      if (state === 'missing') {
        void this.request(assetId);
      }
    }
  }

  /** Reads a blob the view shows; one here or on its way needs nothing, one missing before is looked for again. */
  async request(assetId: TAssetId): Promise<void> {
    const asset = this.services.document().assets.get(assetId);
    if (
      isNil(asset) ||
      asset.storage.kind !== 'blob' ||
      this.loaded.has(assetId) ||
      this.pending.get(assetId) === 'loading'
    ) {
      return;
    }
    this.pending.set(assetId, 'loading');
    const bytes = await this.read(asset, asset.storage.key);
    runInAction(() => {
      if (isNil(bytes)) {
        this.pending.set(assetId, 'missing');
        return;
      }
      this.pending.delete(assetId);
      this.loaded.set(assetId, bytes);
    });
  }

  /** Every file the export carries: inline ones as they are, blobs read now; the ones not to be had, counted. */
  async readAll(): Promise<IReadFiles> {
    const document = this.services.document();
    const bytes = new Map(document.assetBytes);
    let missing = 0;
    for (const asset of document.assets.values()) {
      if (asset.storage.kind === 'blob') {
        const read = this.loaded.get(asset.id) ?? (await this.read(asset, asset.storage.key));
        if (isNil(read)) {
          missing += 1;
        } else {
          bytes.set(asset.id, read);
        }
      }
    }
    return { bytes, missing };
  }

  /** The blob files as sealed, for an encrypted copy: their keys travel inside it. */
  async readAllSealed(): Promise<IReadFiles> {
    const bytes = new Map<TAssetId, TBytes>();
    let missing = 0;
    for (const asset of this.services.document().assets.values()) {
      if (asset.storage.kind === 'blob') {
        const found = await this.found(asset, asset.storage.key);
        if (isNil(found)) {
          missing += 1;
        } else {
          bytes.set(asset.id, found.sealed);
        }
      }
    }
    return { bytes, missing };
  }

  /** Seals a new file beside the local copy; the key in hex goes into the asset the caller adds. */
  async store(assetId: TAssetId, bytes: TBytes): Promise<string | null> {
    const blobKey = newBlobKey(this.services.random);
    this.storedHere.add(assetId);
    const written = await this.services.localCopy.write(
      blobPathBeside(this.services.localPath, assetId),
      await sealBlob(blobKey, assetId, bytes),
      { kind: 'overwrite' },
      this.services.signal
    );
    if (!written.ok || written.value.kind !== 'ok') {
      return null;
    }
    runInAction(() => this.loaded.set(assetId, bytes));
    return toHex(blobKey);
  }

  /**
   * After a sync every blob the document names reaches the
   * cloud, one pass at a time; the first pass of the session also clears the
   * cloud's leftovers.
   */
  uploadMissing(): Promise<void> {
    this.uploads = this.uploads.then(this.uploadPass).then(this.removeGoneFromCloudOnce);
    return this.uploads;
  }

  /**
   * This device's blobs of files the vault no longer has go;
   * one written after the opened copy is judged at the next unlock.
   */
  async removeGone(): Promise<void> {
    const { signal, localCopy, localPath } = this.services;
    const listed = await localCopy.list(
      storagePath(`${folderOf(localPath)}${BLOB_FOLDER}`),
      signal
    );
    if (!listed.ok) {
      return;
    }
    const kept = new Set<string>([...this.services.document().assets.keys(), ...this.storedHere]);
    for (const blob of listed.value) {
      const id = blobIdOf(blob.path);
      const leftover =
        !isNil(id) && !kept.has(id) && blob.modifiedAt < this.services.openedCopyModifiedAt;
      if (leftover) {
        await localCopy.remove(blob.path, { kind: 'match', rev: blob.rev }, signal);
      }
    }
  }

  /**
   * A cloud blob the synced document does not name goes once
   * it is older than the retention: a file leaves the document only that
   * long after it was orphaned, and a blob another device has just uploaded
   * — its document not pulled here yet — is always younger.
   */
  private async removeGoneFromCloudOnce(): Promise<void> {
    const cloud = this.services.cloud();
    if (this.cloudCollected || isNil(cloud)) {
      return;
    }
    const { signal, now } = this.services;
    const listed = await cloud.storage.list(
      storagePath(`${folderOf(cloud.path)}${BLOB_FOLDER}`),
      signal
    );
    if (!listed.ok) {
      return;
    }
    this.cloudCollected = true;
    const named = new Set<string>(this.services.document().assets.keys());
    for (const blob of listed.value) {
      const id = blobIdOf(blob.path);
      if (!isNil(id) && !named.has(id) && now() - blob.modifiedAt >= ORPHAN_RETENTION_MS) {
        await cloud.storage.remove(blob.path, { kind: 'match', rev: blob.rev }, signal);
      }
    }
  }

  private async uploadPass(): Promise<void> {
    const cloud = this.services.cloud();
    const { signal, localCopy, localPath } = this.services;
    if (isNil(cloud)) {
      return;
    }
    for (const asset of this.services.document().assets.values()) {
      if (signal.aborted) {
        return;
      }
      if (asset.storage.kind !== 'blob' || this.inCloud.has(asset.id)) {
        continue;
      }
      const target = blobPathBeside(cloud.path, asset.id);
      const there = await cloud.storage.stat(target, signal);
      if (!there.ok) {
        return;
      }
      if (isNil(there.value)) {
        const local = await localCopy.read(blobPathBeside(localPath, asset.id), signal);
        if (!local.ok || isNil(local.value)) {
          continue;
        }
        const written = await cloud.storage.write(
          target,
          local.value.bytes,
          { kind: 'overwrite' },
          signal
        );
        if (!written.ok) {
          return;
        }
      }
      this.inCloud.add(asset.id);
    }
  }

  private async read(asset: IAsset, blobKeyHex: string): Promise<TBytes | null> {
    return (await this.found(asset, blobKeyHex))?.plain ?? null;
  }

  /**
   * The blob's sealed bytes that open, and what they open to: this device's
   * copy first; the cloud's when it has none or its own does not open, kept
   * here once it does.
   */
  private async found(
    asset: IAsset,
    blobKeyHex: string
  ): Promise<{ readonly sealed: TBytes; readonly plain: TBytes } | null> {
    const blobKey = fromHexBytes(blobKeyHex);
    if (isNil(blobKey)) {
      return null;
    }
    const { signal, localCopy, localPath } = this.services;
    const localTarget = blobPathBeside(localPath, asset.id);
    const local = await localCopy.read(localTarget, signal);
    const fromDevice = await this.opened(blobKey, asset, local.ok ? local.value?.bytes : undefined);
    const cloud = this.services.cloud();
    if (!isNil(fromDevice) || isNil(cloud)) {
      return fromDevice;
    }
    const remote = await cloud.storage.read(blobPathBeside(cloud.path, asset.id), signal);
    const fromCloud = await this.opened(
      blobKey,
      asset,
      remote.ok ? remote.value?.bytes : undefined
    );
    if (!isNil(fromCloud)) {
      await localCopy.write(localTarget, fromCloud.sealed, { kind: 'overwrite' }, signal);
    }
    return fromCloud;
  }

  private async opened(
    blobKey: TBytes,
    asset: IAsset,
    sealed: TBytes | undefined
  ): Promise<{ readonly sealed: TBytes; readonly plain: TBytes } | null> {
    if (isNil(sealed)) {
      return null;
    }
    const opened = await openBlob(blobKey, asset.id, sealed);
    return opened.ok ? { sealed, plain: opened.value } : null;
  }
}
