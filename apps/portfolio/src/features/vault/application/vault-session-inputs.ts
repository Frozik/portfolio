import type { IStorageProvider, TStorageRev } from '@frozik/cloud-storage/core/storage-provider';
import type { IVaultCodec } from '@frozik/vault/codec/vault-codec';
import type { TManifest } from '@frozik/vault/format/manifest';
import type { IVaultKeys } from '@frozik/vault/format/vault-keys';
import type { TCredential } from '@frozik/vault/lifecycle/lifecycle-events';
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

import type { IBreachCheck, TLoadTwoFactorDirectory } from '../domain/ports/audit-sources';
import type { IClipboard } from '../domain/ports/clipboard';
import type { TConnectCloud } from '../domain/ports/cloud';
import type { IImageCompressor } from '../domain/ports/image-compressor';
import type { TAcquireLeadership } from '../domain/ports/leadership';
import type { IPageSignals } from '../domain/ports/page-signals';
import type { TReadQrCode } from '../domain/ports/qr-reader';
import type { ISessionClock } from '../domain/ports/session-clock';
import type { TFetchSiteIcon } from '../domain/ports/site-icons';
import type { IStrengthMeter } from '../domain/ports/strength-meter';
import type { ITabChannel } from '../domain/ports/tab-channel';

/** What the session needs from the device, wired once by the feature's composition root. */
export interface IVaultSessionServices {
  readonly codec: IVaultCodec;
  /** The provider holding this vault's local copy. */
  readonly localCopyOf: (vaultKey: TVaultKey) => IStorageProvider;
  readonly syncState: ISyncStateStore;
  /** Where the sealed draft of the card being edited waits for the next unlock. */
  readonly drafts: ISealedRecordStore;
  readonly random: IRandom;
  readonly clock: ISessionClock;
  readonly page: IPageSignals;
  readonly clipboard: IClipboard;
  readonly openTabChannel: (vaultKey: TVaultKey) => ITabChannel;
  /** Where this device's settings for the vault are sealed. */
  readonly deviceConfig: ISealedRecordStore;
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
