import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Milliseconds } from '@frozik/utils/date/types';
import type { TResult } from '@frozik/utils/result/result';
import { err } from '@frozik/utils/result/result';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import { encodePassword } from '@frozik/vault/crypto/password-normalization';
import type { TTranslate } from '@frozik/vault/model/card-edits';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import type { TSyncStop } from '@frozik/vault/sync/sync-state';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';
import type { TLifecycleEffect } from '../domain/lifecycle-effects';
import type { TLifecycleEvent } from '../domain/lifecycle-events';
import type { TLifecycleState, TLockReason } from '../domain/lifecycle-state';
import { lifecycleStep } from '../domain/lifecycle-step';

import type { IVaultTitle } from '@frozik/vault/model/vault-settings-edits';
import { renameVault } from '@frozik/vault/model/vault-settings-edits';
import { CloudSetup } from '../../cloud/application/CloudSetup';
import { VaultFileOpening } from '../../cloud/application/VaultFileOpening';
import { AppearanceModel } from '../../device/application/AppearanceModel';
import { VaultRegistryModel } from '../../device/application/VaultRegistryModel';
import { CreateVaultForm } from '../../keys/application/CreateVaultForm';
import type { TPasskeyFailure } from '../../keys/domain/ports/passkeys';
import { createVault, openVault } from '../../sync/application/vault-opening';
import type { ILockConsequence } from '../domain/lock-policy';
import { lockConsequence } from '../domain/lock-policy';
import type { IDemoSeed } from '../domain/ports/demo-seed';
import { openWithDevice } from './device-key';
import { QuickLock } from './QuickLock';
import { listedOnDevice } from './session-registry';
import type { IVaultAppServices } from './vault-app-services';
import type { IOpenedSession } from './vault-session-inputs';
import type { IVaultFlows } from './VaultFlows';
import { createVaultFlows } from './VaultFlows';
import type { VaultSession } from './VaultSession';

/**
 * Lives while the vault route is mounted: the device's
 * vaults, the lifecycle of the chosen one and, while unlocked, its session.
 */
export class VaultApp {
  readonly registry: VaultRegistryModel;
  readonly cloud: CloudSetup;
  /** `null` where the platform offers no file chooser. */
  readonly fileOpening: VaultFileOpening | null;
  readonly flows: IVaultFlows;
  readonly appearance: AppearanceModel;
  lifecycle: TLifecycleState = { kind: 'no-vault' };
  session: VaultSession | null = null;
  createForm: CreateVaultForm | null = null;

  private opened: IOpenedSession | null = null;
  /** The quick lock's screen: what it asks for, and the one try. */
  readonly quick: QuickLock;
  /** How the next session starts: after a full unlock (with the master password, if typed) or a quick one. */
  private startedAfter: 'full' | { readonly masterPassword: string } | 'quick' = 'full';
  /** The demo vault gets its cards once its session starts. */
  private pendingDemo: { readonly seed: IDemoSeed; readonly texts: TTranslate } | null = null;
  private readonly controller = new AbortController();

  constructor(private readonly services: IVaultAppServices) {
    this.registry = new VaultRegistryModel(services.registry, services);
    this.cloud = new CloudSetup(services, this.registry);
    const { pickVaultFile } = services;
    this.fileOpening = isNil(pickVaultFile)
      ? null
      : new VaultFileOpening({ ...services, pickVaultFile }, this.registry, this.controller.signal);
    this.flows = createVaultFlows(services, this.controller.signal);
    this.appearance = new AppearanceModel(services.themeStore);
    this.quick = new QuickLock(services, {
      readyChanged: ready => this.dispatch({ kind: 'quick-unlock-changed', ready }),
      expired: () => this.dispatch({ kind: 'quick-expired' }),
      attempted: code => {
        this.startedAfter = 'quick';
        this.dispatch({ kind: 'quick-unlock-requested', code });
      },
    });
    makeAutoObservable<
      VaultApp,
      'services' | 'opened' | 'controller' | 'pendingDemo' | 'startedAfter'
    >(
      this,
      {
        lifecycle: observableRef,
        session: observableRef,
        createForm: observableRef,
        services: false,
        opened: false,
        controller: false,
        pendingDemo: false,
        quick: false,
        startedAfter: false,
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
    this.startedAfter = { masterPassword: password };
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
    await this.registry.retitle(session.vaultKey, session.document.settings);
  }

  /**
   * Removes a vault (the open one by default) from this device: its local copy and every
   * record of it; its session, if this tab has one, ends in every tab. The screen asks first.
   */
  async forgetVault(vaultKey = this.session?.vaultKey): Promise<void> {
    if (isNil(vaultKey)) {
      return;
    }
    await this.registry.forget(vaultKey, this.controller.signal);
    if ('vaultKey' in this.lifecycle && this.lifecycle.vaultKey === vaultKey) {
      this.dispatch({ kind: 'forgotten' });
    }
  }

  /** Must be called synchronously from a click: the browser opens its prompt there or not at all. */
  async unlockWithPasskey(
    vaultKey: TVaultKey,
    credentialIds: readonly TBytes[]
  ): Promise<TPasskeyFailure | null> {
    const answer = await this.flows.passkeyAnswer(vaultKey, credentialIds);
    if (answer.ok) {
      this.dispatch({ kind: 'unlock-requested', credential: { kind: 'prf', ...answer.value } });
    }
    return answer.ok ? null : answer.error;
  }

  /** A local vault with made-up cards, under the password the screen shows. */
  startDemo(name: string, texts: TTranslate): void {
    const { demo } = this.services;
    if (isNil(demo)) {
      return;
    }
    this.pendingDemo = { seed: demo, texts };
    this.create(name, demo.password);
  }

  /** The URL chose a vault; the lifecycle takes it only while nothing is open. */
  choose(vaultKey: TVaultKey): void {
    const { lifecycle } = this;
    if (
      lifecycle.kind === 'no-vault' ||
      (lifecycle.kind === 'locked' && lifecycle.vaultKey !== vaultKey)
    ) {
      this.dispatch({
        kind: 'vault-chosen',
        vaultKey,
        reason: this.services.wipe.takeNote(vaultKey),
        kept: this.quick.restore(vaultKey),
      });
    }
  }

  unlock(password: string): void {
    this.startedAfter = { masterPassword: password };
    this.dispatch({
      kind: 'unlock-requested',
      credential: { kind: 'password', password: encodePassword(password) },
    });
  }

  /** The Emergency Kit's key; the session then asks for a new master password. */
  unlockWithRecoveryKey(recoveryKey: TBytes): void {
    this.startedAfter = 'full';
    this.dispatch({ kind: 'unlock-requested', credential: { kind: 'recovery', recoveryKey } });
  }

  /** The platform's biometric prompt opens the vault enrolled on this device. */
  unlockWithDevice(): void {
    this.startedAfter = 'full';
    this.dispatch({ kind: 'device-unlock-requested' });
  }

  /** Leaving the route frees the session without a reload; the next visit asks for the password again. */
  dispose(): void {
    this.closeCreateForm();
    this.cloud.dispose();
    this.appearance.dispose();
    void this.session?.flushDraft();
    this.endSession(lockConsequence('left', false));
    void this.quick.ended();
    this.controller.abort();
    this.services.disposeCodec();
  }

  private async run(effect: TLifecycleEffect): Promise<void> {
    const { signal } = this.controller;
    switch (effect.kind) {
      case 'create': {
        const created = await listedOnDevice(
          this.registry,
          await createVault(this.services, effect, effect.password, signal),
          this.services.clock.now() as Milliseconds
        );
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
      case 'open':
        return this.opening(
          effect.vaultKey,
          await openVault(this.services, effect.vaultKey, effect.credential, signal)
        );
      case 'quick-open': {
        const key = await this.quick.open(effect.vaultKey, effect.code);
        return this.opening(
          effect.vaultKey,
          isNil(key)
            ? err('wrong-password')
            : await openVault(this.services, effect.vaultKey, { kind: 'session', ...key }, signal)
        );
      }
      case 'quick-lock':
        return this.quickLock();
      case 'device-open': {
        const opened = await openWithDevice(this.services, effect.vaultKey, signal);
        return opened === 'cancelled'
          ? this.dispatch({ kind: 'unlock-cancelled' })
          : this.opening(effect.vaultKey, opened);
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
        return this.endSessionAndReload(effect.vaultKey, effect.reason);
      case 'make-read-only':
        this.session?.makeReadOnly();
        return;
      case 'relocate':
        return;
      default:
        return assertNever(effect);
    }
  }

  /** Loads the session's model only now; one that cannot load (an evicted cache) ends in a lock. */
  private async startSession(): Promise<void> {
    const { opened } = this;
    if (isNil(opened)) {
      return;
    }
    const loaded = await import('./VaultSession').catch(() => null);
    if (isNil(loaded)) {
      this.lock('complete');
      return;
    }
    const { VaultSession } = loaded;
    if (this.opened === opened) {
      const events = {
        onLock: this.lock,
        onSyncStopped: (stop: TSyncStop) => this.dispatch({ kind: 'sync-stopped', stop }),
      };
      this.beginSession(new VaultSession(opened, this.services, events), opened);
    }
  }

  private beginSession(session: VaultSession, opened: IOpenedSession): void {
    this.opened = null;
    this.session = session;
    void this.quick.started(session, this.startedAfter);
    void session.reminder.start(typeof this.startedAfter === 'object');
    this.startedAfter = 'full';
    void this.services.custody.hold(session.vaultKey, {
      dek: opened.keys.dek,
      keyId: opened.keys.keyId,
    });
    this.cloud.attachTo(session);
    void this.registry.retitle(session.vaultKey, session.document.settings);
    const demo = this.pendingDemo;
    this.pendingDemo = null;
    if (!isNil(demo)) {
      void demo.seed.cardsOf(demo.texts).then(cards => session.apply(cards));
    }
  }

  private async opening(
    vaultKey: TVaultKey,
    opened: TResult<IOpenedSession, TUnlockFailure>
  ): Promise<void> {
    if (opened.ok) {
      await this.registry.stampOpened(vaultKey, this.services.clock.now() as Milliseconds);
    }
    runInAction(() => {
      this.opened = opened.ok ? opened.value : null;
    });
    this.dispatch({
      kind: 'opened',
      result: opened.ok ? { ok: true, value: opened.value.access } : opened,
    });
  }

  /** The session ends without a wipe; its key stays behind the quick code for one try. */
  private async quickLock(): Promise<void> {
    const { session } = this;
    const setting = session?.deviceSettings.settings.quickUnlock;
    if (isNil(session) || isNil(setting)) {
      this.dispatch({ kind: 'quick-locked', held: false });
      return;
    }
    const { dek, keyId } = session.keys.current;
    this.endSession(lockConsequence('idle', true));
    const held = await this.quick.lock(session.vaultKey, { dek, keyId }, setting);
    this.dispatch({ kind: 'quick-locked', held });
  }

  /** A full lock: the session, the pepper and anything kept behind a quick code go. */
  private endSessionAndReload(vaultKey: TVaultKey, reason: TLockReason): void {
    const consequence = lockConsequence(reason, false);
    if (consequence.tellPeers) {
      this.session?.announceLock();
    }
    this.endSession(consequence);
    void this.quick.ended();
    if (consequence.wipe) {
      this.services.wipe.wipe({ vaultKey, reason });
    }
  }

  private endSession({ flushClipboard }: ILockConsequence): void {
    const { session } = this;
    this.opened = null;
    if (isNil(session)) {
      return;
    }
    if (flushClipboard) {
      session.clipboard.flush();
    }
    session.dispose();
    this.session = null;
  }
}
