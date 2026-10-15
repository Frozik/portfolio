import type { Milliseconds } from '@frozik/utils/date/types';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { IDeviceSettings } from '../../device/domain/device-settings';
import { patternCode } from '../domain/pattern-code';
import type { TPatternProblem } from '../domain/pattern-code';
import type { IQuickUnlockSetting, TPinProblem, TQuickUnlockKind } from '../domain/quick-code';
import {
  canUseMasterCharacters,
  DEFAULT_QUICK_LIFETIME_MS,
  masterCharactersCode,
  pinCode,
} from '../domain/quick-code';

export type TQuickSetupProblem = TPinProblem | TPatternProblem | 'mismatch' | 'master-too-short';

export type TQuickSetupStep =
  /** The master password first: setting up a way around it needs it. */
  | { readonly kind: 'password'; readonly failure: TUnlockFailure | null }
  | { readonly kind: 'checking' }
  | { readonly kind: 'choose'; readonly problem: 'master-too-short' | null }
  | {
      readonly kind: 'enter';
      readonly method: 'pin' | 'pattern';
      readonly problem: TQuickSetupProblem | null;
    }
  /** The same code once more: a typo must not become the only quick way in. */
  | { readonly kind: 'confirm'; readonly method: 'pin' | 'pattern'; readonly code: string }
  | { readonly kind: 'done' };

export interface IQuickUnlockSetupServices {
  /** The master password typed again; the reason it is wrong, or `null`. */
  readonly check: (password: string) => Promise<TUnlockFailure | null>;
  readonly settings: {
    readonly settings: IDeviceSettings;
    update(change: Partial<IDeviceSettings>): void;
  };
  /** Keeps the vault's key behind the new code across restarts, where the platform can; the master password reads it. */
  readonly keep: ((password: string, setting: IQuickUnlockSetting) => Promise<void>) | null;
}

/** Setting up, changing or switching off this device's quick unlock of the open vault. */
export class QuickUnlockSetup {
  step: TQuickSetupStep = { kind: 'password', failure: null };
  lifetimeMs: Milliseconds;
  /** The master password's first or last four characters are offered only when it is long enough. */
  masterCharactersOffered = false;
  hideLine: boolean;

  private masterPassword = '';

  constructor(private readonly services: IQuickUnlockSetupServices) {
    this.lifetimeMs =
      services.settings.settings.quickUnlock?.lifetimeMs ?? DEFAULT_QUICK_LIFETIME_MS;
    this.hideLine = services.settings.settings.quickUnlock?.hideLine ?? false;
    makeAutoObservable<QuickUnlockSetup, 'services' | 'masterPassword'>(
      this,
      { step: observableRef, services: false, masterPassword: false },
      { autoBind: true }
    );
  }

  get enabled(): TQuickUnlockKind | null {
    return this.services.settings.settings.quickUnlock?.kind ?? null;
  }

  async checkPassword(password: string): Promise<void> {
    if (this.step.kind !== 'password' || password === '') {
      return;
    }
    this.step = { kind: 'checking' };
    const failure = await this.services.check(password);
    runInAction(() => {
      if (isNil(failure)) {
        this.masterPassword = password;
        this.masterCharactersOffered = canUseMasterCharacters(password);
        this.step = { kind: 'choose', problem: null };
      } else {
        this.step = { kind: 'password', failure };
      }
    });
  }

  choose(kind: TQuickUnlockKind): void {
    if (this.step.kind !== 'choose') {
      return;
    }
    if (kind === 'pin' || kind === 'pattern') {
      this.step = { kind: 'enter', method: kind, problem: null };
      return;
    }
    const code = masterCharactersCode(kind, this.masterPassword);
    if (isNil(code)) {
      this.step = { kind: 'choose', problem: 'master-too-short' };
      return;
    }
    this.save(kind, code);
  }

  /** A PIN's digits, or the points a pattern joined. */
  enter(entered: string | readonly number[]): void {
    if (this.step.kind !== 'enter') {
      return;
    }
    const { method } = this.step;
    const code = codeOf(method, entered);
    this.step = code.ok
      ? { kind: 'confirm', method, code: code.value }
      : { kind: 'enter', method, problem: code.error };
  }

  confirm(entered: string | readonly number[]): void {
    if (this.step.kind !== 'confirm') {
      return;
    }
    const { method, code } = this.step;
    const again = codeOf(method, entered);
    if (again.ok && again.value === code) {
      this.save(method, code);
    } else {
      this.step = { kind: 'enter', method, problem: 'mismatch' };
    }
  }

  setLifetime(lifetimeMs: Milliseconds): void {
    this.lifetimeMs = lifetimeMs;
    const current = this.services.settings.settings.quickUnlock;
    if (!isNil(current)) {
      this.services.settings.update({ quickUnlock: { ...current, lifetimeMs } });
    }
  }

  setHideLine(hideLine: boolean): void {
    this.hideLine = hideLine;
    const current = this.services.settings.settings.quickUnlock;
    if (!isNil(current)) {
      this.services.settings.update({ quickUnlock: { ...current, hideLine } });
    }
  }

  /** The setup is left: the master password it checked is forgotten, and it starts over. */
  cancel(): void {
    this.masterPassword = '';
    this.step = { kind: 'password', failure: null };
  }

  switchOff(): void {
    this.services.settings.update({ quickUnlock: null });
  }

  private save(kind: TQuickUnlockKind, code: string): void {
    const setting: IQuickUnlockSetting = {
      kind,
      code,
      lifetimeMs: this.lifetimeMs,
      hideLine: this.hideLine,
      keepOverRestart: this.services.settings.settings.quickUnlock?.keepOverRestart ?? true,
    };
    if (setting.keepOverRestart) {
      void this.services.keep?.(this.masterPassword, setting);
    }
    this.masterPassword = '';
    this.services.settings.update({ quickUnlock: setting });
    this.step = { kind: 'done' };
  }
}

function codeOf(
  method: 'pin' | 'pattern',
  entered: string | readonly number[]
): ReturnType<typeof pinCode> | ReturnType<typeof patternCode> {
  if (method === 'pin') {
    return typeof entered === 'string' ? pinCode(entered) : pinCode('');
  }
  return typeof entered === 'string' ? patternCode([]) : patternCode(entered);
}
