import type { TStorageRev } from '@frozik/cloud-storage/core/storage-provider';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import { toHex } from '@frozik/vault/crypto/bytes';
import type { TUnlock } from '@frozik/vault/format/open-vault';
import { unlockSecretOf } from '@frozik/vault/format/open-vault';
import { latestStampOf } from '@frozik/vault/model/document-stamp';
import { hlcReceive, hlcTick, initialHlc } from '@frozik/vault/model/hlc';
import { emptyVaultDocument } from '@frozik/vault/model/vault-document';
import type { IVaultTitle } from '@frozik/vault/model/vault-settings-edits';
import { renameVault } from '@frozik/vault/model/vault-settings-edits';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { openedGuard } from '@frozik/vault/session/opened-guard';
import { fileHashOf } from '@frozik/vault/session/sync-effect-runner';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { unlockFailureOf } from '@frozik/vault/session/unlock-failure';
import { isNil } from 'lodash-es';

import type {
  IOpenedSession,
  IVaultSessionServices,
} from '../../session/application/vault-session-inputs';
import { newManifest } from '../../session/domain/new-manifest';
import type { IAppIdentity } from '../../session/domain/ports/app-identity';
import { LOCAL_COPY_PATH } from '../domain/local-copy';

const FIRST_REVISION = 1;

export interface IVaultOpeningServices extends IVaultSessionServices {
  readonly identity: IAppIdentity;
}

/** Keys in the Worker, an empty document, the first local write. */
export async function createVault(
  services: IVaultOpeningServices,
  title: IVaultTitle,
  password: TBytes,
  signal: AbortSignal
): Promise<TResult<IOpenedSession, TUnlockFailure>> {
  const created = await services.codec.createKeys(password, signal);
  if (!created.ok) {
    return err(unlockFailureOf(created.error));
  }
  const keys = created.value;
  const deviceId = await services.syncState.deviceId();
  if (!deviceId.ok) {
    return err('unavailable');
  }
  const now = services.clock.now();
  const clock = hlcTick(initialHlc(deviceId.value), now);
  const document = renameVault(emptyVaultDocument(title.name, clock), title, clock);
  const manifest = newManifest(services.identity.createdBy, now);
  const sealed = await services.codec.seal(
    document,
    manifest,
    { ...keys, revision: FIRST_REVISION, movedTo: null },
    signal
  );
  if (!sealed.ok) {
    return err(unlockFailureOf(sealed.error));
  }
  const vaultKey = toHex(keys.vaultId) as TVaultKey;
  const written = await services
    .localCopyOf(vaultKey)
    .write(LOCAL_COPY_PATH, sealed.value, { kind: 'absent' }, signal);
  if (!written.ok || written.value.kind !== 'ok') {
    return err('unavailable');
  }
  return ok({
    vaultKey,
    keys,
    manifest,
    document,
    access: 'read-write',
    guard: {
      vaultId: vaultKey,
      keyId: toHex(keys.keyId),
      maxSeenRevision: FIRST_REVISION,
      maxSeenKeyslotsEpoch: keys.keyslotsEpoch,
      hashAtMaxSeen: await fileHashOf(sealed.value),
      retiredKeyIds: [],
    },
    localRev: written.value.stat.rev,
    localModifiedAt: written.value.stat.modifiedAt,
    cloudRev: null,
    cloudKeyslotsEpoch: keys.keyslotsEpoch,
    unlockedWith: 'password',
    clock,
  });
}

/**
 * The local copy, opened with the credential in the Worker (or with the key a
 * quick lock kept); the clock resumes past what this device stamped.
 */
export async function openVault(
  services: IVaultOpeningServices,
  vaultKey: TVaultKey,
  credential: TUnlock,
  signal: AbortSignal
): Promise<TResult<IOpenedSession, TUnlockFailure>> {
  const read = await services.localCopyOf(vaultKey).read(LOCAL_COPY_PATH, signal);
  if (!read.ok || isNil(read.value)) {
    unlockSecretOf(credential)?.fill(0);
    return err(read.ok ? 'not-found' : 'unavailable');
  }
  const opened = await services.codec.open(read.value.bytes, credential, signal);
  if (!opened.ok) {
    return err(
      credential.kind === 'session' && opened.error.kind === 'key-rotated'
        ? 'biometric-invalidated'
        : unlockFailureOf(opened.error)
    );
  }
  const [deviceId, persisted] = await Promise.all([
    services.syncState.deviceId(),
    services.syncState.get(vaultKey),
  ]);
  if (!deviceId.ok || !persisted.ok) {
    return err('unavailable');
  }
  const remembered = persisted.value;
  return ok({
    vaultKey,
    keys: opened.value.keys,
    manifest: opened.value.manifest,
    document: opened.value.document,
    access: opened.value.access,
    guard: openedGuard(opened.value, await fileHashOf(read.value.bytes), remembered),
    localRev: read.value.stat.rev,
    localModifiedAt: read.value.stat.modifiedAt,
    cloudRev: (remembered?.lastSyncedRev ?? null) as TStorageRev | null,
    cloudKeyslotsEpoch: remembered?.cloudKeyslotsEpoch ?? opened.value.header.keyslotsEpoch,
    unlockedWith: credential.kind === 'session' ? 'password' : credential.kind,
    clock: hlcReceive(
      { ...(remembered?.lastHlc ?? initialHlc(deviceId.value)), node: deviceId.value },
      latestStampOf(opened.value.document),
      services.clock.now()
    ).clock,
  });
}
