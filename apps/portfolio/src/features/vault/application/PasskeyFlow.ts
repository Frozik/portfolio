import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { TUnlockFailure } from '@frozik/vault/lifecycle/lifecycle-state';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { passkeySalt } from '@frozik/vault/session/passkeys-of';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { IPasskeys, TPasskeyFailure } from '../domain/ports/passkeys';
import type { SessionKeys } from './SessionKeys';

export type TPasskeyStep =
  | { readonly kind: 'idle' }
  | { readonly kind: 'checking' }
  /** The password is right: the next click opens the browser's passkey prompt. */
  | { readonly kind: 'ready' }
  | { readonly kind: 'asking' }
  | { readonly kind: 'added' }
  | { readonly kind: 'failed'; readonly failure: TPasskeyFailure | TUnlockFailure };

export interface IPasskeyFlowServices {
  readonly keys: Pick<SessionKeys, 'check' | 'addPasskey' | 'removePasskey'>;
  readonly passkeys: IPasskeys;
  readonly vaultKey: TVaultKey;
  readonly vaultName: () => string;
}

/**
 * A passkey of this device as the quick unlock. The
 * master password is checked first, so a wrong one never leaves a useless
 * credential on the authenticator; then the click opens the browser's prompt.
 */
export class PasskeyFlow {
  password = '';
  step: TPasskeyStep = { kind: 'idle' };

  constructor(private readonly services: IPasskeyFlowServices) {
    makeAutoObservable<PasskeyFlow, 'services'>(
      this,
      { step: observableRef, services: false },
      { autoBind: true }
    );
  }

  supported(): Promise<boolean> {
    return this.services.passkeys.supported();
  }

  setPassword(password: string): void {
    this.password = password;
  }

  async checkPassword(): Promise<void> {
    if (this.password === '' || this.step.kind === 'checking') {
      return;
    }
    this.step = { kind: 'checking' };
    const failure = await this.services.keys.check(this.password);
    runInAction(() => {
      this.step = isNil(failure) ? { kind: 'ready' } : { kind: 'failed', failure };
    });
  }

  /** Must be called synchronously from a click: the browser opens its prompt there or not at all. */
  async create(): Promise<void> {
    if (this.step.kind !== 'ready') {
      return;
    }
    const { services, password } = this;
    const created = services.passkeys.create({
      vaultName: services.vaultName(),
      salt: passkeySalt(services.vaultKey),
    });
    this.step = { kind: 'asking' };
    const answer = await created;
    if (!answer.ok) {
      this.fail(answer.error);
      return;
    }
    const failure = await services.keys.addPasskey(password, answer.value);
    answer.value.prfOutput.fill(0);
    runInAction(() => {
      this.password = '';
      this.step = isNil(failure) ? { kind: 'added' } : { kind: 'failed', failure };
    });
  }

  remove(credentialId: TBytes): void {
    this.services.keys.removePasskey(credentialId);
  }

  reset(): void {
    this.password = '';
    this.step = { kind: 'idle' };
  }

  private fail(failure: TPasskeyFailure | TUnlockFailure): void {
    runInAction(() => {
      this.step = { kind: 'failed', failure };
    });
  }
}
