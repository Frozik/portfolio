import type { TBytes } from '@frozik/vault/crypto/bytes';
import { bytesEqual } from '@frozik/vault/crypto/bytes';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { passkeySalt } from '@frozik/vault/session/passkeys-of';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { IPasskeyCapabilities, IPasskeys, TPasskeyFailure } from '../domain/ports/passkeys';
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
  readonly keys: Pick<SessionKeys, 'check' | 'addPasskey' | 'removePasskey' | 'current'>;
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

  capabilities(): Promise<IPasskeyCapabilities> {
    return this.services.passkeys.capabilities();
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
    const failure = await services.keys.addPasskey(
      password,
      answer.value,
      services.passkeys.rpId()
    );
    answer.value.prfOutput.fill(0);
    runInAction(() => {
      this.password = '';
      this.step = isNil(failure) ? { kind: 'added' } : { kind: 'failed', failure };
    });
  }

  /** The slot goes; a passkey of this site is also signalled as unknown to its authenticator. */
  remove(credentialId: TBytes): void {
    const { keys, passkeys } = this.services;
    const ofThisSite = keys.current.keyslots.some(
      slot =>
        slot.kind === 'prf' &&
        bytesEqual(slot.credentialId, credentialId) &&
        slot.rpId === passkeys.rpId()
    );
    keys.removePasskey(credentialId);
    if (ofThisSite) {
      void passkeys.signalUnknown(credentialId);
    }
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
