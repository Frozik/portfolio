import type { TStorageRev } from '@frozik/cloud-storage/core/storage-provider';
import { millisecondsToISO8601 } from '@frozik/utils/date/iso8601';
import type { Milliseconds } from '@frozik/utils/date/types';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import { toHex } from '@frozik/vault/crypto/bytes';
import type { TManifest } from '@frozik/vault/format/manifest';
import { CURRENT_SCHEMA_VERSION } from '@frozik/vault/format/manifest';
import { unlockSecretOf } from '@frozik/vault/format/open-vault';
import type { TCredential } from '@frozik/vault/lifecycle/lifecycle-events';
import type { TUnlockFailure } from '@frozik/vault/lifecycle/lifecycle-state';
import { latestStampOf } from '@frozik/vault/model/document-stamp';
import { hlcReceive, hlcTick, initialHlc } from '@frozik/vault/model/hlc';
import { emptyVaultDocument } from '@frozik/vault/model/vault-document';
import type { IVaultRegistry, TVaultKey } from '@frozik/vault/persistence/ports';
import { openedGuard } from '@frozik/vault/session/opened-guard';
import { fileHashOf } from '@frozik/vault/session/sync-effect-runner';
import { unlockFailureOf } from '@frozik/vault/session/unlock-failure';
import { isNil } from 'lodash-es';

import { LOCAL_COPY_PATH } from '../domain/local-copy';
import type { IOpenedSession, IVaultSessionServices } from './vault-session-inputs';

const FIRST_REVISION = 1;
const CREATED_BY = 'portfolio web';

/** The manifest of a file this app writes first: a new vault, an encrypted export. */
export function newManifest(now: number): TManifest {
  return {
    format: 'pwv',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: millisecondsToISO8601(now),
    createdBy: CREATED_BY,
  };
}

export interface IVaultOpeningServices extends IVaultSessionServices {
  readonly registry: IVaultRegistry;
}

/** Keys in the Worker, an empty document, the first local write, the registry entry. */
export async function createVault(
  services: IVaultOpeningServices,
  name: string,
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
  const document = emptyVaultDocument(name, clock);
  const manifest = newManifest(now);
  const sealed = await services.codec.seal(
    document,
    manifest,
    { ...keys, revision: FIRST_REVISION, movedTo: null, preserved: [] },
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
  const listed = await services.registry.put({
    vaultKey,
    name,
    lastOpenedAt: now as Milliseconds,
    unsyncedChanges: false,
  });
  if (!listed.ok) {
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

/** The local copy, opened with the credential in the Worker; the clock resumes past what this device stamped. */
export async function openVault(
  services: IVaultOpeningServices,
  vaultKey: TVaultKey,
  credential: TCredential,
  signal: AbortSignal
): Promise<TResult<IOpenedSession, TUnlockFailure>> {
  const read = await services.localCopyOf(vaultKey).read(LOCAL_COPY_PATH, signal);
  if (!read.ok || isNil(read.value)) {
    unlockSecretOf(credential)?.fill(0);
    return err(read.ok ? 'not-found' : 'unavailable');
  }
  const opened = await services.codec.open(read.value.bytes, credential, signal);
  if (!opened.ok) {
    return err(unlockFailureOf(opened.error));
  }
  const [deviceId, persisted] = await Promise.all([
    services.syncState.deviceId(),
    services.syncState.get(vaultKey),
  ]);
  if (!deviceId.ok || !persisted.ok) {
    return err('unavailable');
  }
  const remembered = persisted.value;
  const known = await services.registry.list();
  const entry = known.ok ? known.value.find(vault => vault.vaultKey === vaultKey) : undefined;
  if (!isNil(entry)) {
    await services.registry.put({ ...entry, lastOpenedAt: services.clock.now() as Milliseconds });
  }
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
    unlockedWith: credential.kind,
    clock: hlcReceive(
      { ...(remembered?.lastHlc ?? initialHlc(deviceId.value)), node: deviceId.value },
      latestStampOf(opened.value.document),
      services.clock.now()
    ).clock,
  });
}
