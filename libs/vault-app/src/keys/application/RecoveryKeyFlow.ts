import type { TBytes } from '@frozik/vault/crypto/bytes';
import {
  formatRecoveryKey,
  generateRecoveryKey,
  recoverySymbols,
} from '@frozik/vault/crypto/recovery-key';
import type { IRandom } from '@frozik/vault/ports/random';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { IFileToSave, TSaveFile } from '../../interchange/domain/ports/file-saver';
import type { TRenderEmergencyKit } from '../domain/ports/emergency-kit';
import type { SessionKeys } from './SessionKeys';

const KEY_GROUP_SEPARATOR = '-';

export type TRecoveryKeyStep =
  | { readonly kind: 'idle' }
  /** The key on screen once: the user writes it down or saves the Emergency Kit. */
  | { readonly kind: 'shown'; readonly formatted: string }
  /** The slot is written only once the last group is typed back. */
  | {
      readonly kind: 'confirming';
      readonly formatted: string;
      readonly failure: TUnlockFailure | null;
    }
  | { readonly kind: 'saving' }
  | { readonly kind: 'done' };

export type TEmergencyKit =
  | { readonly kind: 'making' }
  | { readonly kind: 'ready'; readonly file: IFileToSave }
  | { readonly kind: 'failed' };

export interface IRecoveryKeyServices {
  readonly keys: Pick<SessionKeys, 'addRecoveryKey'>;
  readonly random: IRandom;
  readonly renderKit: TRenderEmergencyKit;
  readonly saveFile: TSaveFile;
}

/**
 * A recovery key: made here, shown once with
 * its Emergency Kit, confirmed by typing its last group back, then written
 * as a slot with the master password. A new key replaces the earlier one.
 */
export class RecoveryKeyFlow {
  step: TRecoveryKeyStep = { kind: 'idle' };
  kit: TEmergencyKit = { kind: 'making' };
  lastGroup = '';
  password = '';

  private key: TBytes | null = null;

  constructor(private readonly services: IRecoveryKeyServices) {
    makeAutoObservable<RecoveryKeyFlow, 'services' | 'key'>(
      this,
      { step: observableRef, kit: observableRef, services: false, key: false },
      { autoBind: true }
    );
  }

  get lastGroupMatches(): boolean {
    const { step } = this;
    if (step.kind !== 'confirming') {
      return false;
    }
    const expected = step.formatted.split(KEY_GROUP_SEPARATOR).at(-1) ?? '';
    return recoverySymbols(this.lastGroup) === expected;
  }

  get canConfirm(): boolean {
    return this.lastGroupMatches && this.password !== '';
  }

  start(): void {
    this.forgetKey();
    const key = generateRecoveryKey(this.services.random);
    const formatted = formatRecoveryKey(key);
    this.key = key;
    this.step = { kind: 'shown', formatted };
    this.kit = { kind: 'making' };
    void this.makeKit(formatted);
  }

  /** Must be called synchronously from a click: the save dialog opens there or not at all. */
  saveKit(): void {
    if (this.kit.kind === 'ready') {
      void this.services.saveFile(this.kit.file);
    }
  }

  toConfirmation(): void {
    if (this.step.kind === 'shown') {
      this.step = { kind: 'confirming', formatted: this.step.formatted, failure: null };
    }
  }

  setLastGroup(lastGroup: string): void {
    this.lastGroup = lastGroup;
  }

  setPassword(password: string): void {
    this.password = password;
  }

  async confirm(): Promise<void> {
    const { step, key } = this;
    if (step.kind !== 'confirming' || !this.canConfirm || isNil(key)) {
      return;
    }
    const { password } = this;
    this.password = '';
    this.step = { kind: 'saving' };
    const failure = await this.services.keys.addRecoveryKey(password, key);
    runInAction(() => {
      if (isNil(failure)) {
        this.forgetKey();
        this.step = { kind: 'done' };
      } else {
        this.step = { ...step, failure };
      }
    });
  }

  cancel(): void {
    this.forgetKey();
    this.step = { kind: 'idle' };
  }

  dispose(): void {
    this.forgetKey();
  }

  private async makeKit(formatted: string): Promise<void> {
    const made = await this.services.renderKit(formatted).then(
      file => ({ kind: 'ready', file }) as const,
      () => ({ kind: 'failed' }) as const
    );
    runInAction(() => {
      const { step } = this;
      if ((step.kind === 'shown' || step.kind === 'confirming') && step.formatted === formatted) {
        this.kit = made;
      }
    });
  }

  /** Best effort: the bytes are zeroed; the string on screen goes with the step. */
  private forgetKey(): void {
    this.key?.fill(0);
    this.key = null;
    this.kit = { kind: 'making' };
    this.lastGroup = '';
    this.password = '';
  }
}
