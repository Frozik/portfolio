import type { IStorageProvider, TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
import type { IHlc } from '@frozik/vault/model/hlc';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import type { TPersistenceError, TVaultKey } from '@frozik/vault/persistence/ports';
import type { IRandom } from '@frozik/vault/ports/random';
import { createDraftRecord } from '@frozik/vault/session/draft-record';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import type { TSyncEvent } from '@frozik/vault/sync/sync-events';
import type { ISyncGuard, TSyncStop } from '@frozik/vault/sync/sync-state';
import { initialSyncState } from '@frozik/vault/sync/sync-state';
import { isNil } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';
import { Temporal } from 'temporal-polyfill';
import type { TLockReason } from '../domain/lifecycle-state';
import { createDeviceRecords } from './device-records';
import type { ISessionFlows } from './session-flows';
import { createSessionFlows } from './session-flows';

import { VaultAudit } from '../../audit/application/VaultAudit';
import { CloudLink } from '../../cloud/application/CloudLink';
import { cloudLinkRecord } from '../../cloud/application/web-cloud-link-record';
import type { DeviceSettingsModel } from '../../device/application/DeviceSettingsModel';
import { CardEditing } from '../../document/application/CardEditing';
import { startHousekeeping } from '../../document/application/housekeeping';
import type { RecentCards } from '../../document/application/RecentCards';
import { createSessionFiles, followCloudSyncs } from '../../document/application/session-files';
import { SessionDocument } from '../../document/application/SessionDocument';
import { startSiteIconLoader } from '../../document/application/SiteIconLoader';
import type { TDocumentEdit } from '../../document/application/transact';
import type { VaultFiles } from '../../document/application/VaultFiles';
import { VaultView } from '../../document/application/VaultView';
import { ClipboardGuard } from '../../exposure/application/ClipboardGuard';
import { ProtectedGateModel } from '../../exposure/application/ProtectedGateModel';
import { RevealModel } from '../../exposure/application/RevealModel';
import type { KeyRotation } from '../../keys/application/KeyRotation';
import { ReminderModel } from '../../keys/application/ReminderModel';
import { createKeyRotation } from '../../keys/application/session-rotation';
import { SessionKeys } from '../../keys/application/SessionKeys';
import { createSessionBackups } from '../../sync/application/session-backups';
import { createSessionReplica } from '../../sync/application/session-replica';
import { SyncController } from '../../sync/application/SyncController';
import type { TSyncTarget } from '../../sync/application/SyncRecord';
import { SyncRecord } from '../../sync/application/SyncRecord';
import type { VaultBackups } from '../../sync/application/VaultBackups';
import { LOCAL_COPY_PATH } from '../../sync/domain/local-copy';
import type { ITabChannel } from '../domain/ports/tab-channel';
import { followLockSignals } from './session-lock-signals';
import type { IOpenedSession, IVaultSessionServices } from './vault-session-inputs';

/** The device store record of this vault's device settings. */

/**
 * Born at unlock, gone at lock. The only owner of the
 * key and of the document; every change goes through `apply`.
 */
export class VaultSession {
  readonly content: SessionDocument;
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
  readonly reminder: ReminderModel;
  readonly flows: ISessionFlows;

  private readonly controller = new AbortController();
  readonly deviceSettings: DeviceSettingsModel;
  readonly recent: RecentCards;
  private readonly stopLockSignals: () => void;
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
    this.content = new SessionDocument(opened, {
      now: services.clock.now,
      onEdited: () => {
        this.backups.noteEdit();
        this.local.dispatch({ kind: 'push-requested' });
        this.cloud.requestPush();
      },
    });
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
      onPasswordChanged: () => this.deviceSettings.update({ quickUnlock: null }),
    });
    this.reveal = new RevealModel(services.clock, services.signals);
    this.protectedGate = new ProtectedGateModel(services.clock);
    ({ deviceSettings: this.deviceSettings, recent: this.recent } = createDeviceRecords(
      services,
      opened,
      () => this.document
    ));
    this.reminder = new ReminderModel({
      check: this.keys.check,
      settings: this.deviceSettings,
      clock: services.clock,
    });
    this.flows = createSessionFlows(services, this);
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
      () => this.content.stamp
    );
    this.local = new SyncController(
      this.replica('local', services.localCopyOf(opened.vaultKey), LOCAL_COPY_PATH),
      initialSyncState(opened.guard, opened.localRev),
      { onEvent: event => this.localEvent(event), onStopped: owner.onSyncStopped }
    );
    this.cloud = new CloudLink({
      vaultKey: opened.vaultKey,
      clock: services.clock,
      signals: services.signals,
      acquireLeadership: services.acquireLeadership,
      engine: (provider, path, lastSyncedRev) =>
        new SyncController(
          this.replica('cloud', provider, path),
          initialSyncState(this.syncRecord.seenBy('cloud'), lastSyncedRev),
          { onStopped: owner.onSyncStopped }
        ),
      keysAheadOfCloud: () => this.syncRecord.cloudBehind(this.keys.current.keyslotsEpoch),
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
      stamp: () => this.content.stamp,
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
        owner.onLock('other-client');
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
    this.stopLockSignals = followLockSignals({
      signals: services.signals,
      clock: services.clock,
      timeouts: () => this.deviceSettings.settings.lock,
      onLock: owner.onLock,
    });

    makeAutoObservable<
      VaultSession,
      | 'opened'
      | 'services'
      | 'tabs'
      | 'stopListeningToTabs'
      | 'controller'
      | 'stopLockSignals'
      | 'stopUploadingFiles'
      | 'stopLoadingSiteIcons'
      | 'stopHousekeeping'
      | 'syncRecord'
    >(
      this,
      {
        content: false,
        opened: false,
        services: false,
        tabs: false,
        stopListeningToTabs: false,
        controller: false,
        stopLockSignals: false,
        stopUploadingFiles: false,
        stopLoadingSiteIcons: false,
        stopHousekeeping: false,
        syncRecord: false,
        flows: false,
        now: false,
      },
      { autoBind: true }
    );
    void this.editing.offerLeftDraft();
    void this.deviceSettings.load();
    void this.recent.load();
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

  get document(): IVaultDocument {
    return this.content.document;
  }

  get readOnly(): boolean {
    return this.content.readOnly;
  }

  makeReadOnly(): void {
    this.content.makeReadOnly();
  }

  /** The one way to change the vault: stamped, applied at once, written behind. */
  transact<T>(edit: TDocumentEdit<T>): T | null {
    return this.content.transact(edit);
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
    this.stopUploadingFiles();
    this.stopLoadingSiteIcons();
    this.stopHousekeeping();
    this.stopLockSignals();
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
    const { changed, localHasNews } = this.content.merge(remote);
    if (changed) {
      if (target === 'cloud') {
        void this.backups.keep('before-sync');
        this.local.dispatch({ kind: 'push-requested' });
      } else {
        this.cloud.requestPush();
      }
    }
    return localHasNews;
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
