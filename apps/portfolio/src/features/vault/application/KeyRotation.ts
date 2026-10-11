import type { TStorageResult } from '@frozik/cloud-storage/core/storage-error';
import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import type {
  IStorageProvider,
  TStorageRev,
  TWritePrecondition,
  TWriteResult,
} from '@frozik/cloud-storage/core/storage-provider';
import type { IVaultCodec } from '@frozik/vault/codec/vault-codec';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import { bytesEqual, toHex } from '@frozik/vault/crypto/bytes';
import { encodePassword } from '@frozik/vault/crypto/password-normalization';
import type { TManifest } from '@frozik/vault/format/manifest';
import type { IVaultKeys } from '@frozik/vault/format/vault-keys';
import type { TUnlockFailure } from '@frozik/vault/lifecycle/lifecycle-state';
import { mergeDocument } from '@frozik/vault/merge/merge-document';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import type { ISealedRecordStore, TVaultKey } from '@frozik/vault/persistence/ports';
import type { IRandom } from '@frozik/vault/ports/random';
import { resealRecords } from '@frozik/vault/session/reseal-records';
import { unlockFailureOf } from '@frozik/vault/session/unlock-failure';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import { LOCAL_COPY_PATH } from '../domain/local-copy';
import type { SessionKeys } from './SessionKeys';

export type TKeyRotationFailure =
  | TUnlockFailure
  /** The cloud has changes this device has not taken in yet: rotating now would lose them. */
  | 'not-synced'
  /** Someone wrote a copy meanwhile: nothing past that copy was replaced; the next unlock tries again. */
  | 'changed-meanwhile'
  /** The cloud holds a file under a key this device rotated away from: a rollback, refused. */
  | 'rollback-security';

export type TKeyRotationState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'working' }
  | { readonly kind: 'failed'; readonly failure: TKeyRotationFailure };

interface ICloudTarget {
  readonly storage: IStorageProvider;
  readonly path: string;
  readonly lastSyncedRev: TStorageRev | null;
}

export interface IKeyRotationServices {
  readonly vaultKey: TVaultKey;
  readonly codec: IVaultCodec;
  readonly random: IRandom;
  readonly manifest: TManifest;
  readonly keys: SessionKeys;
  readonly document: () => IVaultDocument;
  readonly localCopy: IStorageProvider;
  /** The local copy's revision the local engine last wrote or read: another tab's write since is a conflict. */
  readonly localRev: () => TStorageRev | null;
  /** The cloud the vault is kept in, `null` for a vault on this device only. */
  readonly cloud: () => ICloudTarget | null;
  /** Both copies have taken everything in: a rotation now loses nothing. */
  readonly settled: () => boolean;
  readonly seenRevision: () => number;
  readonly isRetired: (keyId: string) => boolean;
  readonly retire: (keyId: string) => Promise<unknown>;
  readonly deviceConfig: ISealedRecordStore;
  readonly drafts: ISealedRecordStore;
  /** The pending draft sealed, edits and draft saves frozen, both engines stopped: nothing seals under the old key in between. */
  readonly freeze: () => Promise<void>;
  /** Every tab locks and reloads; the next unlock opens under the key the copies hold. */
  readonly finish: () => void;
  readonly signal: AbortSignal;
}

const DEVICE_CONFIG_LABEL = 'pwv/device-config';
const DRAFT_LABEL = 'pwv/draft';

function precondition(rev: TStorageRev | null): TWritePrecondition {
  return isNil(rev) ? { kind: 'absent' } : { kind: 'match', rev };
}

function failureOf(result: TStorageResult<TWriteResult>): TKeyRotationFailure | null {
  if (!result.ok) {
    return 'unavailable';
  }
  return result.value.kind === 'ok' ? null : 'changed-meanwhile';
}

/**
 * A new key for the vault: made here with the master
 * password, or followed here when another device made it. The session is
 * frozen, the document sealed under the new key into the cloud first and the
 * local copy second; only once both are written are this device's records
 * sealed again and the old key retired. The session then ends — the old key
 * must not stay in memory. A failure on the way leaves the records under the
 * key the local copy still has, so the next unlock picks up from there.
 */
export class KeyRotation {
  state: TKeyRotationState = { kind: 'idle' };

  constructor(private readonly services: IKeyRotationServices) {
    makeAutoObservable<KeyRotation, 'services'>(
      this,
      { state: observableRef, services: false },
      { autoBind: true }
    );
  }

  /** The key is suspect: everything goes under a new one; passkeys and the recovery key are made again. */
  async rotate(password: string): Promise<void> {
    const { services } = this;
    if (!services.settled()) {
      this.state = { kind: 'failed', failure: 'not-synced' };
      return;
    }
    this.state = { kind: 'working' };
    const rotated = await services.codec.rotateKey(
      services.keys.current,
      encodePassword(password),
      services.signal
    );
    if (!rotated.ok) {
      this.fail(unlockFailureOf(rotated.error));
      return;
    }
    const cloud = services.cloud();
    await services.freeze();
    await this.switchTo(rotated.value, {
      document: services.document(),
      revision: services.seenRevision() + 1,
      cloud,
      cloudRev: cloud?.lastSyncedRev ?? null,
    });
  }

  /** The cloud file is under a key this session lacks: the master password opens it, the copies merge. */
  async follow(password: string): Promise<void> {
    const { services } = this;
    const cloud = services.cloud();
    if (isNil(cloud)) {
      return;
    }
    this.state = { kind: 'working' };
    const read = await cloud.storage.read(storagePath(cloud.path), services.signal);
    if (!read.ok || isNil(read.value)) {
      this.fail('unavailable');
      return;
    }
    const opened = await services.codec.open(
      read.value.bytes,
      { kind: 'password', password: encodePassword(password) },
      services.signal
    );
    if (!opened.ok) {
      this.fail(unlockFailureOf(opened.error));
      return;
    }
    const { keys, header, document } = opened.value;
    if (!bytesEqual(keys.vaultId, services.keys.current.vaultId)) {
      this.fail('corrupted');
      return;
    }
    if (
      keys.keyGeneration <= services.keys.current.keyGeneration ||
      services.isRetired(toHex(keys.keyId))
    ) {
      this.fail('rollback-security');
      return;
    }
    await services.freeze();
    await this.switchTo(keys, {
      document: mergeDocument(services.document(), document),
      revision: Math.max(header.revision, services.seenRevision()) + 1,
      cloud,
      cloudRev: read.value.stat.rev,
    });
  }

  private fail(failure: TKeyRotationFailure): void {
    runInAction(() => {
      this.state = { kind: 'failed', failure };
    });
  }

  /** The copies under the new key, then the records; a failure ends the session with the records untouched. */
  private async switchTo(
    keys: IVaultKeys,
    {
      document,
      revision,
      cloud,
      cloudRev,
    }: {
      readonly document: IVaultDocument;
      readonly revision: number;
      readonly cloud: ICloudTarget | null;
      readonly cloudRev: TStorageRev | null;
    }
  ): Promise<void> {
    const { services } = this;
    const localRev = services.localRev();
    const sealed = await services.codec.seal(
      document,
      services.manifest,
      { ...keys, revision, movedTo: null, preserved: [] },
      services.signal
    );
    const failure = sealed.ok
      ? await this.writeCopies(sealed.value, { cloud, cloudRev, localRev })
      : 'unavailable';
    if (!isNil(failure)) {
      this.fail(failure);
      services.finish();
      return;
    }
    const oldKeys = services.keys.current;
    const reseal = { vaultKey: services.vaultKey, from: oldKeys.dek, to: keys.dek };
    await resealRecords({
      ...reseal,
      store: services.deviceConfig,
      label: DEVICE_CONFIG_LABEL,
      random: services.random,
    });
    await resealRecords({
      ...reseal,
      store: services.drafts,
      label: DRAFT_LABEL,
      random: services.random,
    });
    await services.retire(toHex(oldKeys.keyId));
    services.finish();
  }

  private async writeCopies(
    file: TBytes,
    {
      cloud,
      cloudRev,
      localRev,
    }: {
      readonly cloud: ICloudTarget | null;
      readonly cloudRev: TStorageRev | null;
      readonly localRev: TStorageRev | null;
    }
  ): Promise<TKeyRotationFailure | null> {
    const { signal } = this.services;
    if (!isNil(cloud)) {
      const toCloud = failureOf(
        await cloud.storage.write(storagePath(cloud.path), file, precondition(cloudRev), signal)
      );
      if (!isNil(toCloud)) {
        return toCloud;
      }
    }
    return failureOf(
      await this.services.localCopy.write(LOCAL_COPY_PATH, file, precondition(localRev), signal)
    );
  }
}
