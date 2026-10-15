import type { IStorageProvider, TStorageRev } from '@frozik/cloud-storage/core/storage-provider';
import type { IVaultCodec } from '@frozik/vault/codec/vault-codec';
import type { TManifest } from '@frozik/vault/format/manifest';
import type { IVaultKeys } from '@frozik/vault/format/vault-keys';
import type { IHlc } from '@frozik/vault/model/hlc';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import type {
  ISealedRecordStore,
  ISnapshotStore,
  ISyncStateStore,
  TVaultKey,
} from '@frozik/vault/persistence/ports';
import type { IRandom } from '@frozik/vault/ports/random';
import type { ISyncGuard } from '@frozik/vault/sync/sync-state';
import type { IClipboard } from '../../exposure/domain/ports/clipboard';
import type { TCredential } from '../domain/lifecycle-events';

import type { IBreachCheck, TLoadTwoFactorDirectory } from '../../audit/domain/ports/audit-sources';
import type { IStrengthMeter } from '../../audit/domain/ports/strength-meter';
import type { TConnectCloud } from '../../cloud/domain/ports/cloud';
import type { IImageCompressor } from '../../document/domain/ports/image-compressor';
import type { TReadQrCode } from '../../document/domain/ports/qr-reader';
import type { TFetchSiteIcon } from '../../document/domain/ports/site-icons';
import type { TAcquireLeadership } from '../domain/ports/leadership';
import type { ILockSignalSource } from '../domain/ports/lock-signal-source';
import type { ISessionClock } from '../domain/ports/session-clock';
import type { ITabChannel } from '../domain/ports/tab-channel';
import type { IVaultFlowServices } from './VaultFlows';

/** What the session needs from the device, wired once by the feature's composition root. */
export interface IVaultSessionServices extends IVaultFlowServices {
  readonly codec: IVaultCodec;
  /** The provider holding this vault's local copy. */
  readonly localCopyOf: (vaultKey: TVaultKey) => IStorageProvider;
  readonly syncState: ISyncStateStore;
  /** Where the sealed draft of the card being edited waits for the next unlock. */
  readonly drafts: ISealedRecordStore;
  readonly random: IRandom;
  readonly clock: ISessionClock;
  readonly signals: ILockSignalSource;
  readonly clipboard: IClipboard;
  readonly openTabChannel: (vaultKey: TVaultKey) => ITabChannel;
  /** Where this device's settings for the vault are sealed. */
  readonly deviceConfig: ISealedRecordStore;
  /** Where this device keeps, sealed, which cards were opened lately. */
  readonly usage: ISealedRecordStore;
  readonly compressor: IImageCompressor;
  readonly readQrCode: TReadQrCode;
  /** A site's icon from an icon service. */
  readonly fetchSiteIcon: TFetchSiteIcon;
  readonly connectCloud: TConnectCloud;
  /** The local copy as it was, before a cloud version changed it. */
  readonly snapshots: ISnapshotStore;
  readonly acquireLeadership: TAcquireLeadership;
  /** What the audit asks the outside world. */
  readonly auditSources: {
    readonly meter: () => IStrengthMeter;
    readonly breaches: IBreachCheck;
    readonly loadTwoFactorDirectory: TLoadTwoFactorDirectory;
  };
}

/** A vault just opened or created: what a session starts from. */
export interface IOpenedSession {
  readonly vaultKey: TVaultKey;
  readonly keys: IVaultKeys;
  readonly manifest: TManifest;
  readonly document: IVaultDocument;
  readonly access: 'read-write' | 'read-only';
  readonly guard: ISyncGuard;
  /** The local copy's revision as read; `null` before its first write. */
  readonly localRev: TStorageRev | null;
  /** When the local copy opened was written: blobs written since are not judged leftovers. */
  readonly localModifiedAt: number;
  /** The cloud revision last synced, kept as it is: the local engine never moves it. */
  readonly cloudRev: TStorageRev | null;
  /** The newest slot set the cloud has shown this device. */
  readonly cloudKeyslotsEpoch: number;
  /** Opened with the recovery key, a new master password is due. */
  readonly unlockedWith: TCredential['kind'];
  readonly clock: IHlc;
}
