import { isNil } from 'lodash-es';
import { runInAction } from 'mobx';
import type { TLockReason } from '../../session/domain/lifecycle-state';

import type { IVaultDocument } from '@frozik/vault/model/vault-document';

import type { CloudLink } from '../../cloud/application/CloudLink';
import type { DeviceSettingsModel } from '../../device/application/DeviceSettingsModel';
import type { CardEditing } from '../../document/application/CardEditing';
import type { RecentCards } from '../../document/application/RecentCards';
import type {
  IOpenedSession,
  IVaultSessionServices,
} from '../../session/application/vault-session-inputs';
import type { SyncController } from '../../sync/application/SyncController';
import type { SyncRecord } from '../../sync/application/SyncRecord';
import { KeyRotation } from './KeyRotation';
import type { SessionKeys } from './SessionKeys';

/** What a rotation reads from the session and pauses in it. */
interface IRotatingSession {
  readonly keys: SessionKeys;
  readonly document: IVaultDocument;
  readonly local: SyncController;
  readonly cloud: CloudLink;
  readonly editing: CardEditing;
  readonly deviceSettings: DeviceSettingsModel;
  readonly recent: Pick<RecentCards, 'saved'>;
  makeReadOnly(): void;
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
    usage: services.usage,
    freeze: async () => {
      await Promise.all([
        session.flushDraft(),
        session.deviceSettings.saved(),
        session.recent.saved(),
      ]);
      runInAction(() => {
        session.editing.freeze();
        session.deviceSettings.freeze();
        session.makeReadOnly();
      });
      session.local.dispose();
      session.cloud.detach();
    },
    forgetDeviceKey: () => services.deviceUnlock?.forget(opened.vaultKey) ?? Promise.resolve(),
    finish: () => onLock('complete'),
    signal,
  });
}
