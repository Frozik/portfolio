import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import { encodePassword } from '@frozik/vault/crypto/password-normalization';
import type { ICxfExporter } from '@frozik/vault/export/cxf/export-cxf';
import type { TLifecycleEffect } from '@frozik/vault/lifecycle/lifecycle-effects';
import type { TLifecycleEvent } from '@frozik/vault/lifecycle/lifecycle-events';
import type { TLifecycleState, TLockReason } from '@frozik/vault/lifecycle/lifecycle-state';
import { lifecycleStep } from '@frozik/vault/lifecycle/lifecycle-step';
import type { TTranslate } from '@frozik/vault/model/card-edits';
import type { TPersisted, TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { IVaultTitle } from '@frozik/vault/model/vault-settings-edits';
import { renameVault } from '@frozik/vault/model/vault-settings-edits';
import { passkeySalt, passkeysOf } from '@frozik/vault/session/passkeys-of';
import { fileHashOf } from '@frozik/vault/session/sync-effect-runner';
import { withDemoSiteIcons } from '../domain/demo-site-icons';
import { DEMO_SCAN } from '../domain/demo-specimen';
import { DEMO_VAULT_PASSWORD, withDemoCards } from '../domain/demo-vault';
import { LOCAL_COPY_PATH } from '../domain/local-copy';
import type { TRenderEmergencyKit } from '../domain/ports/emergency-kit';
import type { TSaveFile } from '../domain/ports/file-saver';
import type { TOpenGoogleDrive } from '../domain/ports/google-drive';
import type { TReadKdbx } from '../domain/ports/kdbx-reader';
import type { IPasskeys, TPasskeyFailure } from '../domain/ports/passkeys';
import type { IStrengthMeter } from '../domain/ports/strength-meter';
import type { TProbeWebDav } from '../domain/ports/webdav-prober';
import { CloudSetup } from './CloudSetup';
import { CreateVaultForm } from './CreateVaultForm';
import { PasskeyFlow } from './PasskeyFlow';
import { RecoveryKeyFlow } from './RecoveryKeyFlow';
import { createVault, openVault } from './vault-opening';
import type { IVaultOpeningServices } from './vault-opening';
import type { IOpenedSession } from './vault-session-inputs';
import { VaultExport } from './VaultExport';
import { VaultImport } from './VaultImport';
import { VaultRegistryModel, withTitle } from './VaultRegistryModel';
import { VaultSession } from './VaultSession';

/**
 * Locks every tab shares: the user's own, and those that make
 * the key itself untrusted. Idle, hidden and page-left belong to one tab
 *: the tab in use must not lock because another one sat idle.
 */
const LOCKS_FOR_EVERY_TAB: ReadonlySet<TLockReason> = new Set([
  'manual',
  'key-rotated',
  'rollback-security',
  'forgotten',
]);

/** Locks that leave the page as it is: the page is going away, or the user went elsewhere. */
const LOCKS_WITHOUT_RELOAD: ReadonlySet<TLockReason> = new Set(['pagehide', 'route-left']);

export interface IVaultFeatureServices extends IVaultOpeningServices {
  /** A dying process is the only real wipe; the same URL comes back locked. */
  readonly reload: () => void;
  readonly disposeCodec: () => void;
  readonly createStrengthMeter: () => IStrengthMeter;
  readonly probeWebDav: TProbeWebDav;
  readonly openGoogleDrive: TOpenGoogleDrive;
  /** This device forgets one vault: its records and what it saw of it. */
  readonly forgetOnDevice: (vaultKey: TVaultKey) => TPersisted<void>;
  readonly saveFile: TSaveFile;
  readonly passkeys: IPasskeys;
  readonly readKdbx: TReadKdbx;
  /** The host the vault runs on and its name, written into a CXF export. */
  readonly exporter: Omit<ICxfExporter, 'accountId'>;
}

/**
 * Lives while the vault route is mounted: the device's
 * vaults, the lifecycle of the chosen one and, while unlocked, its session.
 */
export class VaultFeatureStore {
  readonly registry: VaultRegistryModel;
  readonly cloud: CloudSetup;
  lifecycle: TLifecycleState = { kind: 'no-vault' };
  session: VaultSession | null = null;
  createForm: CreateVaultForm | null = null;

  private opened: IOpenedSession | null = null;
  /** The demo vault gets its cards once its session starts. */
  private demoTexts: TTranslate | null = null;
  private readonly controller = new AbortController();

  constructor(private readonly services: IVaultFeatureServices) {
    this.registry = new VaultRegistryModel(services.registry);
    this.cloud = new CloudSetup(services, this.registry);
    makeAutoObservable<VaultFeatureStore, 'services' | 'opened' | 'controller' | 'demoTexts'>(
      this,
      {
        lifecycle: observableRef,
        session: observableRef,
        createForm: observableRef,
        services: false,
        opened: false,
        controller: false,
        demoTexts: false,
      },
      { autoBind: true }
    );
  }

  dispatch(event: TLifecycleEvent): void {
    if (this.controller.signal.aborted) {
      return;
    }
    const next = lifecycleStep(this.lifecycle, event);
    this.lifecycle = next.state;
    next.effects.forEach(effect => void this.run(effect));
  }

  lock(reason: TLockReason): void {
    this.dispatch({ kind: 'lock-requested', reason });
  }

  /** The typed password becomes bytes here and travels on; the Worker zeroes its copy. */
  create(name: string, password: string, description = ''): void {
    this.dispatch({
      kind: 'create-requested',
      name,
      description,
      password: encodePassword(password),
    });
  }

  openCreateForm(): void {
    this.createForm ??= new CreateVaultForm(
      this.services.createStrengthMeter(),
      this.services.clock
    );
  }

  closeCreateForm(): void {
    this.createForm?.dispose();
    this.createForm = null;
  }

  submitCreateForm(): void {
    const taken = this.createForm?.take();
    if (!isNil(taken)) {
      this.closeCreateForm();
      this.create(taken.name, taken.password, taken.description);
    }
  }

  /** The name and description live in the vault (synchronised) and in this device's list of vaults. */
  async renameVault(title: IVaultTitle): Promise<void> {
    const { session } = this;
    if (isNil(session)) {
      return;
    }
    session.apply((document, at) => renameVault(document, title, at));
    await this.registry.change(session.vaultKey, entry =>
      withTitle(entry, session.document.settings)
    );
  }

  /**
   * Removes a vault (the open one by default) from this device: its local copy and every
   * record of it; its session, if this tab has one, ends in every tab. The screen asks first.
   */
  async forgetVault(vaultKey = this.session?.vaultKey): Promise<void> {
    if (isNil(vaultKey)) {
      return;
    }
    const { signal } = this.controller;
    await this.services
      .localCopyOf(vaultKey)
      .remove(LOCAL_COPY_PATH, { kind: 'overwrite' }, signal);
    await this.services.forgetOnDevice(vaultKey);
    if ('vaultKey' in this.lifecycle && this.lifecycle.vaultKey === vaultKey) {
      this.dispatch({ kind: 'forgotten' });
    }
    await this.registry.refresh();
  }

  /** An import into the open vault, for as long as the screen showing it. */
  importInto(session: VaultSession, translate: TTranslate): VaultImport {
    const { codec, random } = this.services;
    return new VaultImport({
      document: () => session.document,
      transact: session.transact,
      codec,
      random,
      translate,
      readQrCode: this.services.readQrCode,
      readKdbx: this.services.readKdbx,
      storeBlob: session.files.store,
    });
  }

  /** An export of the open vault, for as long as the screen showing it. */
  exportOf(session: VaultSession): VaultExport {
    return new VaultExport({
      document: () => session.document,
      codec: this.services.codec,
      checkPassword: session.keys.check,
      saveFile: this.services.saveFile,
      now: this.services.clock.now,
      readFiles: session.files.readAll,
      readSealedBlobs: session.files.readAllSealed,
      cxfExporter: { ...this.services.exporter, accountId: session.vaultKey },
    });
  }

  /** A recovery key for the open vault, for as long as the screen showing it. */
  recoveryKeyOf(session: VaultSession, renderKit: TRenderEmergencyKit): RecoveryKeyFlow {
    return new RecoveryKeyFlow({
      keys: session.keys,
      random: this.services.random,
      renderKit,
      saveFile: this.services.saveFile,
    });
  }

  /** Passkeys of the open vault, for as long as the screen showing them. */
  passkeysOf(session: VaultSession): PasskeyFlow {
    return new PasskeyFlow({
      keys: session.keys,
      passkeys: this.services.passkeys,
      vaultKey: session.vaultKey,
      vaultName: () => session.document.settings.name,
    });
  }

  /** D15 — the passkeys a locked vault opens with, from its local copy's plaintext header. */
  async passkeysOfLocked(vaultKey: TVaultKey): Promise<readonly TBytes[]> {
    const read = await this.services
      .localCopyOf(vaultKey)
      .read(LOCAL_COPY_PATH, this.controller.signal);
    return read.ok && !isNil(read.value) ? passkeysOf(read.value.bytes) : [];
  }

  /** D15 — must be called synchronously from a click: the browser opens its prompt there or not at all. */
  async unlockWithPasskey(
    vaultKey: TVaultKey,
    credentialIds: readonly TBytes[]
  ): Promise<TPasskeyFailure | null> {
    const answer = await this.services.passkeys.get({ credentialIds, salt: passkeySalt(vaultKey) });
    if (!answer.ok) {
      return answer.error;
    }
    this.dispatch({ kind: 'unlock-requested', credential: { kind: 'prf', ...answer.value } });
    return null;
  }

  /** A local vault with made-up cards, under the password the screen shows. */
  startDemo(name: string, texts: TTranslate): void {
    this.demoTexts = texts;
    this.create(name, DEMO_VAULT_PASSWORD);
  }

  /** The URL chose a vault; the lifecycle takes it only while nothing is open. */
  choose(vaultKey: TVaultKey): void {
    const { lifecycle } = this;
    if (
      lifecycle.kind === 'no-vault' ||
      (lifecycle.kind === 'locked' && lifecycle.vaultKey !== vaultKey)
    ) {
      this.dispatch({ kind: 'vault-chosen', vaultKey });
    }
  }

  unlock(password: string): void {
    this.dispatch({
      kind: 'unlock-requested',
      credential: { kind: 'password', password: encodePassword(password) },
    });
  }

  /** The Emergency Kit's key; the session then asks for a new master password. */
  unlockWithRecoveryKey(recoveryKey: TBytes): void {
    this.dispatch({ kind: 'unlock-requested', credential: { kind: 'recovery', recoveryKey } });
  }

  /** Leaving the route frees the session without a reload; the next visit asks for the password again. */
  dispose(): void {
    this.closeCreateForm();
    this.cloud.dispose();
    void this.session?.flushDraft();
    this.endSession('route-left');
    this.controller.abort();
    this.services.disposeCodec();
  }

  private async run(effect: TLifecycleEffect): Promise<void> {
    const { signal } = this.controller;
    switch (effect.kind) {
      case 'create': {
        const created = await createVault(this.services, effect, effect.password, signal);
        runInAction(() => {
          this.opened = created.ok ? created.value : null;
        });
        this.dispatch({
          kind: 'created',
          result: created.ok ? { ok: true, value: created.value.vaultKey } : created,
        });
        void this.registry.refresh();
        return;
      }
      case 'open': {
        const opened = await openVault(this.services, effect.vaultKey, effect.credential, signal);
        runInAction(() => {
          this.opened = opened.ok ? opened.value : null;
        });
        this.dispatch({
          kind: 'opened',
          result: opened.ok ? { ok: true, value: opened.value.access } : opened,
        });
        return;
      }
      case 'start-session':
        return this.startSession();
      case 'flush-draft': {
        const flushing = this.session?.flushDraft();
        if (!isNil(flushing)) {
          await flushing;
        }
        return this.dispatch({ kind: 'draft-flushed' });
      }
      case 'end-session-and-reload':
        return this.endSessionAndReload(effect.reason);
      case 'make-read-only':
        if (!isNil(this.session)) {
          this.session.readOnly = true;
        }
        return;
      case 'relocate':
        return;
      default:
        return assertNever(effect);
    }
  }

  private startSession(): void {
    const { opened } = this;
    this.opened = null;
    if (isNil(opened)) {
      return;
    }
    const session = new VaultSession(opened, this.services, {
      onLock: this.lock,
      onSyncStopped: stop => this.dispatch({ kind: 'sync-stopped', stop }),
    });
    this.session = session;
    this.cloud.attachTo(session);
    void this.registry.change(session.vaultKey, entry =>
      withTitle(entry, session.document.settings)
    );
    const texts = this.demoTexts;
    this.demoTexts = null;
    if (!isNil(texts)) {
      void this.seedDemo(session, texts);
    }
  }

  /** The made-up cards; the scan's hash is computed first, as hashing is asynchronous. */
  private async seedDemo(session: VaultSession, texts: TTranslate): Promise<void> {
    const scan = { ...DEMO_SCAN, sha256: await fileHashOf(DEMO_SCAN.bytes) };
    session.apply((document, at) =>
      withDemoSiteIcons(
        withDemoCards(document, {
          translate: texts,
          random: this.services.random,
          at,
          today: this.services.clock.today(),
          scan,
        }),
        at
      )
    );
  }

  private endSessionAndReload(reason: TLockReason): void {
    if (LOCKS_FOR_EVERY_TAB.has(reason)) {
      this.session?.announceLock();
    }
    this.endSession(reason);
    if (!LOCKS_WITHOUT_RELOAD.has(reason)) {
      this.services.reload();
    }
  }

  private endSession(reason: TLockReason): void {
    const { session } = this;
    this.opened = null;
    if (isNil(session)) {
      return;
    }
    if (reason !== 'pagehide') {
      session.clipboard.flush();
    }
    session.dispose();
    this.session = null;
  }
}
