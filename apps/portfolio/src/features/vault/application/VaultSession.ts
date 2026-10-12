import type { IStorageProvider, TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
import type { TLockReason, TUnlockFailure } from '@frozik/vault/lifecycle/lifecycle-state';
import { mergeDocument } from '@frozik/vault/merge/merge-document';
import { latestStampOf } from '@frozik/vault/model/document-stamp';
import type { IHlc } from '@frozik/vault/model/hlc';
import { hlcReceive, hlcTick } from '@frozik/vault/model/hlc';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import type { TPersistenceError, TVaultKey } from '@frozik/vault/persistence/ports';
import type { IRandom } from '@frozik/vault/ports/random';
import { createDraftRecord } from '@frozik/vault/session/draft-record';
import { createSealedJsonRecord } from '@frozik/vault/session/sealed-json-record';
import type { TSyncEvent } from '@frozik/vault/sync/sync-events';
import type { ISyncGuard, TSyncStop } from '@frozik/vault/sync/sync-state';
import { initialSyncState } from '@frozik/vault/sync/sync-state';
import { isEqual, isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, reaction, runInAction } from 'mobx';
import { Temporal } from 'temporal-polyfill';

import { LOCAL_COPY_PATH } from '../domain/local-copy';
import type { ILockTimeouts } from '../domain/lock-deadline';
import type { ITabChannel } from '../domain/ports/tab-channel';
import { CardEditing } from './CardEditing';
import { ClipboardGuard } from './ClipboardGuard';
import { cloudLinkRecord } from './cloud-link-record';
import { CloudLink } from './CloudLink';
import { decodeDeviceSettings, DeviceSettingsModel } from './DeviceSettingsModel';
import { startHousekeeping } from './housekeeping';
import type { KeyRotation } from './KeyRotation';
import { LockSignals } from './LockSignals';
import { ProtectedGateModel } from './ProtectedGateModel';
import { RevealModel } from './RevealModel';
import { createSessionBackups } from './session-backups';
import { createSessionFiles, followCloudSyncs } from './session-files';
import { createSessionReplica } from './session-replica';
import { createKeyRotation } from './session-rotation';
import { SessionKeys } from './SessionKeys';
import { startSiteIconLoader } from './SiteIconLoader';
import { SyncController } from './SyncController';
import type { TSyncTarget } from './SyncRecord';
import { SyncRecord } from './SyncRecord';
import type { TDocumentEdit } from './transact';
import type { IOpenedSession, IVaultSessionServices } from './vault-session-inputs';
import { VaultAudit } from './VaultAudit';
import type { VaultBackups } from './VaultBackups';
import type { VaultFiles } from './VaultFiles';
import { VaultView } from './VaultView';

/** The device store record of this vault's device settings. */
const DEVICE_SETTINGS_RECORD = 'device-settings';

/**
 * Born at unlock, gone at lock. The only owner of the
 * key and of the document; every change goes through `apply`.
 */
export class VaultSession {
  document: IVaultDocument;
  readOnly: boolean;
  deviceStoreFailure: TPersistenceError | null = null;

  readonly local: SyncController;
  readonly cloud: CloudLink;
  readonly view: VaultView;
  readonly editing: CardEditing;
  readonly reveal: RevealModel;
  readonly protectedGate: ProtectedGateModel;
  readonly clipboard: ClipboardGuard;
  readonly keys: SessionKeys;
  readonly rotation: KeyRotation;
  readonly audit: VaultAudit;
  readonly files: VaultFiles;
  readonly backups: VaultBackups;

  private clock: IHlc;
  private readonly controller = new AbortController();
  readonly deviceSettings: DeviceSettingsModel;
  private lockSignals: LockSignals;
  private readonly stopFollowingSettings: () => void;
  private stopUploadingFiles: () => void = () => undefined;
  private stopLoadingSiteIcons: () => void = () => undefined;
  private readonly stopHousekeeping: () => void;
  private readonly tabs: ITabChannel;
  private readonly stopListeningToTabs: () => void;
  private readonly syncRecord: SyncRecord;

  constructor(
    private readonly opened: IOpenedSession,
    private readonly services: IVaultSessionServices,
    owner: {
      readonly onLock: (reason: TLockReason) => void;
      readonly onSyncStopped: (stop: TSyncStop) => void;
    }
  ) {
    this.document = opened.document;
    this.readOnly = opened.access === 'read-only';
    this.clock = opened.clock;
    this.view = new VaultView(
      () => this.document,
      services.clock,
      () => this.audit.problems
    );
    this.keys = new SessionKeys(opened.keys, opened.unlockedWith, {
      codec: services.codec,
      localCopy: services.localCopyOf(opened.vaultKey),
      signal: this.controller.signal,
      onChanged: () => {
        this.local.dispatch({ kind: 'push-requested' });
        this.cloud.requestPush();
      },
    });
    this.reveal = new RevealModel(services.clock, services.page);
    this.protectedGate = new ProtectedGateModel(services.clock);
    this.deviceSettings = new DeviceSettingsModel(
      createSealedJsonRecord({
        store: services.deviceConfig,
        vaultKey: opened.vaultKey,
        recordKey: DEVICE_SETTINGS_RECORD,
        dek: opened.keys.dek,
        label: 'pwv/device-config',
        random: services.random,
        decode: decodeDeviceSettings,
      })
    );
    this.clipboard = new ClipboardGuard(
      services.clipboard,
      services.clock,
      () => this.deviceSettings.settings.clipboardClearMs
    );
    this.syncRecord = new SyncRecord(
      services.syncState,
      opened.vaultKey,
      { guard: opened.guard, cloudKeyslotsEpoch: opened.cloudKeyslotsEpoch },
      opened.cloudRev,
      () => this.clock
    );
    this.local = new SyncController(
      this.replica('local', services.localCopyOf(opened.vaultKey), LOCAL_COPY_PATH),
      initialSyncState(opened.guard, opened.localRev),
      { onEvent: event => this.localEvent(event), onStopped: owner.onSyncStopped }
    );
    this.cloud = new CloudLink({
      vaultKey: opened.vaultKey,
      clock: services.clock,
      page: services.page,
      acquireLeadership: services.acquireLeadership,
      replica: (provider, path) => this.replica('cloud', provider, path),
      initialState: lastSyncedRev =>
        initialSyncState(this.syncRecord.seenBy('cloud'), lastSyncedRev),
      keysAheadOfCloud: () => this.syncRecord.cloudBehind(this.keys.current.keyslotsEpoch),
      onStopped: owner.onSyncStopped,
      connect: services.connectCloud,
      link: cloudLinkRecord(services.deviceConfig, opened, services.random),
      record: this.syncRecord,
      localFile: signal => services.localCopyOf(opened.vaultKey).read(LOCAL_COPY_PATH, signal),
    });
    this.backups = createSessionBackups(this, {
      services,
      opened,
      signal: this.controller.signal,
    });
    this.files = createSessionFiles(this, {
      services,
      opened,
      signal: this.controller.signal,
    });
    this.editing = new CardEditing({
      document: () => this.document,
      readOnly: () => this.readOnly,
      stamp: () => this.clock,
      transact: edit => this.transact(edit),
      record: createDraftRecord({
        store: services.drafts,
        vaultKey: opened.vaultKey,
        dek: opened.keys.dek,
        random: services.random,
      }),
      clock: services.clock,
      random: services.random,
      compressor: services.compressor,
      readQrCode: services.readQrCode,
      storeBlob: (assetId, bytes) => this.files.store(assetId, bytes),
    });
    this.tabs = services.openTabChannel(opened.vaultKey);
    this.stopListeningToTabs = this.tabs.onMessage(message => {
      if (message.kind === 'changed') {
        this.local.dispatch({ kind: 'pull-requested' });
      } else {
        owner.onLock('other-tab');
      }
    });
    this.audit = new VaultAudit({
      ...services.auditSources,
      meter: services.auditSources.meter(),
      document: () => this.document,
      checkLeaks: () => this.deviceSettings.settings.checkLeaks,
      clock: services.clock,
      today: () => this.view.today,
    });
    this.rotation = createKeyRotation(this, {
      services,
      opened,
      syncRecord: this.syncRecord,
      onLock: owner.onLock,
      signal: this.controller.signal,
    });
    const watchPage = (timeouts: ILockTimeouts): LockSignals =>
      new LockSignals(services.page, services.clock, timeouts, owner.onLock);
    this.lockSignals = watchPage(this.deviceSettings.settings.lock);
    this.stopFollowingSettings = reaction(
      () => this.deviceSettings.settings.lock,
      timeouts => {
        this.lockSignals.dispose();
        this.lockSignals = watchPage(timeouts);
      }
    );

    makeAutoObservable<
      VaultSession,
      | 'opened'
      | 'services'
      | 'clock'
      | 'lockSignals'
      | 'tabs'
      | 'stopListeningToTabs'
      | 'controller'
      | 'stopFollowingSettings'
      | 'stopUploadingFiles'
      | 'stopLoadingSiteIcons'
      | 'stopHousekeeping'
      | 'syncRecord'
    >(
      this,
      {
        document: observableRef,
        opened: false,
        services: false,
        clock: false,
        lockSignals: false,
        tabs: false,
        stopListeningToTabs: false,
        controller: false,
        stopFollowingSettings: false,
        stopUploadingFiles: false,
        stopLoadingSiteIcons: false,
        stopHousekeeping: false,
        syncRecord: false,
        now: false,
      },
      { autoBind: true }
    );
    void this.editing.offerLeftDraft();
    void this.deviceSettings.load();
    this.stopUploadingFiles = followCloudSyncs(this, this.files);
    this.stopLoadingSiteIcons = startSiteIconLoader({
      document: () => this.document,
      enabled: () => this.deviceSettings.settings.loadSiteIcons && !this.readOnly,
      fetchIcon: services.fetchSiteIcon,
      transact: this.transact,
      now: services.clock.now,
      signal: this.controller.signal,
    });
    this.stopHousekeeping = startHousekeeping({
      today: () => this.view.today,
      now: services.clock.now,
      heldFiles: () => this.editing.heldFiles,
      transact: this.transact,
    });
  }

  get vaultKey(): TVaultKey {
    return this.opened.vaultKey;
  }

  /** The instant one-time codes are computed at: this device's clock until a time source corrects it. */
  readonly now = (): Temporal.Instant =>
    Temporal.Instant.fromEpochMilliseconds(this.services.clock.now());

  /** New ids (a duplicated card, a group) come from the session's one source of randomness. */
  get random(): IRandom {
    return this.services.random;
  }

  /** The one way to change the vault: stamped, applied at once, written behind. */
  transact<T>(edit: TDocumentEdit<T>): T | null {
    if (this.readOnly) {
      return null;
    }
    this.clock = hlcTick(this.clock, this.services.clock.now());
    const { document, result } = edit(this.document, this.clock);
    if (document !== this.document) {
      this.backups.noteEdit();
      this.document = document;
      this.local.dispatch({ kind: 'push-requested' });
      this.cloud.requestPush();
    }
    return result;
  }

  apply(edit: (document: IVaultDocument, at: IHlc) => IVaultDocument): void {
    this.transact((document, at) => ({ document: edit(document, at), result: undefined }));
  }

  /** The other tabs lock too: one user, one session. */
  announceLock(): void {
    this.tabs.post({ kind: 'locked' });
  }

  /** Protected cards open for a while once the master password is typed again. */
  async openProtected(password: string): Promise<TUnlockFailure | null> {
    const failure = await this.keys.check(password);
    if (isNil(failure)) {
      runInAction(() => this.protectedGate.open());
    }
    return failure;
  }

  /** The lock seals the pending draft before the page reloads; `null` when nothing waits. */
  flushDraft(): Promise<unknown> | null {
    return this.editing.flush();
  }

  dispose(): void {
    this.controller.abort();
    this.editing.dispose();
    this.stopFollowingSettings();
    this.stopUploadingFiles();
    this.stopLoadingSiteIcons();
    this.stopHousekeeping();
    this.lockSignals.dispose();
    this.local.dispose();
    this.cloud.dispose();
    this.view.dispose();
    this.audit.dispose();
    this.stopListeningToTabs();
    this.tabs.close();
    this.reveal.dispose();
    this.protectedGate.dispose();
    this.clipboard.dispose();
  }

  private localEvent(event: TSyncEvent): void {
    if (event.kind === 'write-done' && event.result.ok && event.result.value.kind === 'ok') {
      this.tabs.post({ kind: 'changed' });
    }
  }

  /** News from one replica is pushed to the other. */
  private merge(target: TSyncTarget, remote: IVaultDocument): boolean {
    const before = this.document;
    this.document = mergeDocument(this.document, remote);
    this.clock = hlcReceive(
      this.clock,
      latestStampOf(this.document),
      this.services.clock.now()
    ).clock;
    if (this.document !== before && !isEqual(this.document, before)) {
      if (target === 'cloud') {
        void this.backups.keep('before-sync');
        this.local.dispatch({ kind: 'push-requested' });
      } else {
        this.cloud.requestPush();
      }
    }
    return !isEqual(this.document, mergeDocument(remote, remote));
  }

  private async saveGuard(
    target: TSyncTarget,
    guard: ISyncGuard,
    lastSyncedRev: string | null
  ): Promise<void> {
    const saved = await this.syncRecord.save(target, guard, lastSyncedRev);
    runInAction(() => {
      this.deviceStoreFailure = saved.ok ? null : saved.error;
    });
  }

  private replica(target: TSyncTarget, provider: IStorageProvider, path: TStoragePath) {
    return createSessionReplica({
      provider,
      path,
      codec: this.services.codec,
      random: this.services.random,
      keys: () => this.keys.current,
      adoptKeys: this.keys.adopt,
      keysShared: target === 'cloud' ? this.keys.shared : () => undefined,
      manifest: this.opened.manifest,
      clock: this.services.clock,
      document: () => this.document,
      merge: remote => this.merge(target, remote),
      saveGuard: (guard, lastSyncedRev) => this.saveGuard(target, guard, lastSyncedRev),
    });
  }
}
