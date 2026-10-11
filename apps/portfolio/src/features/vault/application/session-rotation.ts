import type { TLockReason } from '@frozik/vault/lifecycle/lifecycle-state';
import { isNil } from 'lodash-es';
import { runInAction } from 'mobx';

import type { IVaultDocument } from '@frozik/vault/model/vault-document';

import type { CardEditing } from './CardEditing';
import type { CloudLink } from './CloudLink';
import type { DeviceSettingsModel } from './DeviceSettingsModel';
import { KeyRotation } from './KeyRotation';
import type { SessionKeys } from './SessionKeys';
import type { SyncController } from './SyncController';
import type { SyncRecord } from './SyncRecord';
import type { IOpenedSession, IVaultSessionServices } from './vault-session-inputs';

/** What a rotation reads from the session and pauses in it. */
interface IRotatingSession {
  readonly keys: SessionKeys;
  readonly document: IVaultDocument;
  readonly local: SyncController;
  readonly cloud: CloudLink;
  readonly editing: CardEditing;
  readonly deviceSettings: DeviceSettingsModel;
  readOnly: boolean;
  flushDraft(): Promise<unknown> | null;
}

/** The session's key rotation, wired to the engines it pauses and the records it re-seals. */
export function createKeyRotation(
  session: IRotatingSession,
  {
    services,
    opened,
    syncRecord,
    onLock,
    signal,
  }: {
    readonly services: IVaultSessionServices;
    readonly opened: IOpenedSession;
    readonly syncRecord: SyncRecord;
    readonly onLock: (reason: TLockReason) => void;
    readonly signal: AbortSignal;
  }
): KeyRotation {
  return new KeyRotation({
    vaultKey: opened.vaultKey,
    codec: services.codec,
    random: services.random,
    manifest: opened.manifest,
    keys: session.keys,
    document: () => session.document,
    localCopy: services.localCopyOf(opened.vaultKey),
    cloud: () => {
      const { connection } = session.cloud;
      return isNil(connection)
        ? null
        : {
            ...connection,
            path: connection.location.path,
            lastSyncedRev: syncRecord.cloudRev,
          };
    },
    settled: () =>
      session.local.state.phase.kind === 'idle' &&
      (session.cloud.status.kind === 'none' || session.cloud.status.kind === 'synced'),
    seenRevision: () => syncRecord.seenBy('local').maxSeenRevision,
    localRev: () => session.local.state.context.lastSyncedRev,
    isRetired: keyId => syncRecord.isRetired(keyId),
    retire: keyId => syncRecord.retire(keyId),
    deviceConfig: services.deviceConfig,
    drafts: services.drafts,
    freeze: async () => {
      await Promise.all([session.flushDraft(), session.deviceSettings.saved()]);
      runInAction(() => {
        session.editing.freeze();
        session.deviceSettings.freeze();
        session.readOnly = true;
      });
      session.local.dispose();
      session.cloud.detach();
    },
    finish: () => onLock('manual'),
    signal,
  });
}
