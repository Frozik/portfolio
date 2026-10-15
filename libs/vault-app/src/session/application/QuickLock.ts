import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, reaction, runInAction } from 'mobx';

import type { IQuickUnlockSetting, TQuickPrompt } from '../../keys/domain/quick-code';
import type { TQuickEntryProblem } from '../../keys/domain/quick-code';
import { codeOfEntry, masterCharactersCode, quickPromptOf } from '../../keys/domain/quick-code';
import type { ICustodyKey, ISessionKeyCustody } from '../domain/ports/key-custody';
import type { IQuickKeep } from '../domain/ports/quick-keep';
import type { IQuickPepper } from '../domain/ports/quick-pepper';
import type { ISessionClock } from '../domain/ports/session-clock';
import { quickKeyOf } from '../domain/quick-key';
import type { VaultSession } from './VaultSession';

export interface IQuickLockServices {
  readonly pepper: IQuickPepper;
  readonly custody: ISessionKeyCustody;
  readonly clock: ISessionClock;
  /** Where the platform keeps a quick lock across restarts (a phone); none keeps it in memory only. */
  readonly quickKeep?: IQuickKeep;
}

/**
 * The quick lock's machinery around one open vault: a fresh pepper at every
 * full unlock, the key kept behind the peppered code at a quick lock, the one
 * try, and the lifetime after which the lock becomes full.
 */
export class QuickLock {
  /** What the quick lock screen asks for while the key waits behind the code. */
  prompt: TQuickPrompt | null = null;

  private stopFollowing: () => void = () => undefined;
  private stopKeeping: () => void = () => undefined;
  private cancelExpiry: () => void = () => undefined;
  private vaultKey: TVaultKey | null = null;

  constructor(
    private readonly services: IQuickLockServices,
    private readonly events: {
      readonly readyChanged: (ready: boolean) => void;
      readonly expired: () => void;
      /** The one try, in the code's canonical form. */
      readonly attempted: (code: string) => void;
    }
  ) {
    makeAutoObservable<
      QuickLock,
      'services' | 'events' | 'stopFollowing' | 'stopKeeping' | 'cancelExpiry' | 'vaultKey'
    >(
      this,
      {
        prompt: observableRef,
        services: false,
        events: false,
        stopFollowing: false,
        stopKeeping: false,
        cancelExpiry: false,
        vaultKey: false,
      },
      { autoBind: true }
    );
  }

  /**
   * A session started. After a full unlock the pepper is new; a code taken
   * from the master password is taken again from the one just typed.
   */
  async started(
    session: VaultSession,
    after: 'full' | { readonly masterPassword: string } | 'quick'
  ): Promise<void> {
    if (after !== 'quick') {
      await this.services.pepper.renew();
    }
    this.stopFollowing();
    this.stopFollowing = reaction(
      () => !isNil(session.deviceSettings.settings.quickUnlock),
      this.events.readyChanged,
      { fireImmediately: true }
    );
    this.vaultKey = session.vaultKey;
    const { quickKeep } = this.services;
    this.stopKeeping();
    if (!isNil(quickKeep)) {
      this.stopKeeping = reaction(
        () => session.deviceSettings.settings.quickUnlock,
        setting => {
          if (isNil(setting) || !setting.keepOverRestart) {
            quickKeep.forget(session.vaultKey);
          }
        }
      );
    }
    if (typeof after === 'object') {
      await session.deviceSettings.loaded();
      this.refreshMasterCharacters(session, after.masterPassword);
      await this.keep(session, after.masterPassword);
    }
  }

  /** The master password just typed reads the key once, to keep it behind the code across restarts. */
  async keep(session: VaultSession, masterPassword: string): Promise<void> {
    const { quickKeep } = this.services;
    const setting = session.deviceSettings.settings.quickUnlock;
    if (isNil(quickKeep)) {
      return;
    }
    if (isNil(setting) || !setting.keepOverRestart) {
      quickKeep.forget(session.vaultKey);
      return;
    }
    await quickKeep.arm(
      session.vaultKey,
      session.keys.current,
      masterPassword,
      setting,
      this.services.clock.now()
    );
  }

  /** A restart found a quick lock kept for this vault: its screen and its lifetime come back. */
  restore(vaultKey: TVaultKey): boolean {
    const now = this.services.clock.now();
    const kept = this.services.quickKeep?.kept(vaultKey, now);
    if (isNil(kept)) {
      return false;
    }
    this.vaultKey = vaultKey;
    this.cancelExpiry();
    this.cancelExpiry = this.services.clock.after(kept.expiresAt - now, this.events.expired);
    this.prompt = kept.prompt;
    return true;
  }

  /**
   * What the quick lock screen took: a PIN's or four characters' text, or the
   * points a pattern joined. An entry that is no code (a pattern of three
   * points) is not the one try: the screen says why and waits.
   */
  attempt(entry: string | readonly number[]): TQuickEntryProblem | null {
    const { prompt } = this;
    if (isNil(prompt)) {
      return null;
    }
    const code = codeOfEntry(prompt.kind, entry);
    if (!code.ok) {
      return code.error;
    }
    this.events.attempted(code.value);
    return null;
  }

  /** The session is about to end quickly: its key stays behind the peppered code; `false` if it could not. */
  async lock(
    vaultKey: TVaultKey,
    key: ICustodyKey,
    setting: IQuickUnlockSetting
  ): Promise<boolean> {
    this.stopFollowing();
    const peppered = await this.services.pepper.mix(setting.code);
    if (isNil(peppered)) {
      return false;
    }
    await this.services.custody.lockQuick(vaultKey, key, await quickKeyOf(peppered));
    this.services.quickKeep?.touch(vaultKey, setting.lifetimeMs, this.services.clock.now());
    this.cancelExpiry = this.services.clock.after(setting.lifetimeMs, this.events.expired);
    runInAction(() => {
      this.prompt = quickPromptOf(setting);
    });
    return true;
  }

  /** The one try: the key, or `null` with nothing kept. */
  async open(vaultKey: TVaultKey, code: string): Promise<ICustodyKey | null> {
    this.cancelExpiry();
    this.prompt = null;
    const { quickKeep } = this.services;
    const peppered = await this.services.pepper.mix(code);
    if (isNil(peppered)) {
      await this.services.custody.release();
      return isNil(quickKeep) ? null : quickKeep.open(vaultKey, code);
    }
    const key = await this.services.custody.unlockQuick(vaultKey, await quickKeyOf(peppered));
    if (isNil(key)) {
      quickKeep?.forget(vaultKey);
    }
    return key;
  }

  /** A full lock: the pepper, the kept key and the timer go. */
  async ended(): Promise<void> {
    this.prompt = null;
    this.stopFollowing();
    this.stopKeeping();
    this.cancelExpiry();
    if (!isNil(this.vaultKey)) {
      this.services.quickKeep?.forget(this.vaultKey);
    }
    this.services.pepper.destroy();
    await this.services.custody.release();
  }

  private refreshMasterCharacters(session: VaultSession, masterPassword: string): void {
    const setting = session.deviceSettings.settings.quickUnlock;
    if (isNil(setting) || (setting.kind !== 'first-four' && setting.kind !== 'last-four')) {
      return;
    }
    const code = masterCharactersCode(setting.kind, masterPassword);
    if (isNil(code)) {
      session.deviceSettings.update({ quickUnlock: null });
    } else if (code !== setting.code) {
      session.deviceSettings.update({ quickUnlock: { ...setting, code } });
    }
  }
}
