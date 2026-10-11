import type { TRecoveryKeyError } from '@frozik/vault/crypto/recovery-key';
import { parseRecoveryKey } from '@frozik/vault/crypto/recovery-key';
import type { TUnlockFailure } from '@frozik/vault/lifecycle/lifecycle-state';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { TMasterPasswordProblem } from '../domain/master-password';
import { masterPasswordProblem } from '../domain/master-password';
import type { SessionKeys, TCurrentSecret } from './SessionKeys';

export type TChangePasswordProblem =
  | Exclude<TMasterPasswordProblem, 'not-acknowledged'>
  | TRecoveryKeyError
  | 'no-current';

/** What proves the user may change the password: the old one, or after a recovery the recovery key. */
export type TChangePasswordMode = 'password' | 'recovery';

export type TChangePasswordStep =
  | { readonly kind: 'editing'; readonly failure: TUnlockFailure | null }
  | { readonly kind: 'changing' }
  | { readonly kind: 'changed' };

/**
 * The current password, the new one twice;
 * the same rules as at creation. Every device takes the new password with
 * the next sync; the vault's key stays the same.
 */
export class ChangePasswordForm {
  current = '';
  password = '';
  confirmation = '';
  step: TChangePasswordStep = { kind: 'editing', failure: null };

  constructor(
    private readonly keys: Pick<SessionKeys, 'change'>,
    readonly mode: TChangePasswordMode
  ) {
    makeAutoObservable<ChangePasswordForm, 'keys'>(
      this,
      { step: observableRef, keys: false, mode: false },
      { autoBind: true }
    );
  }

  get problem(): TChangePasswordProblem | null {
    if (this.current === '') {
      return 'no-current';
    }
    if (this.mode === 'recovery') {
      const parsed = parseRecoveryKey(this.current);
      if (!parsed.ok) {
        return parsed.error;
      }
      parsed.value.fill(0);
    }
    const problem = masterPasswordProblem({ ...this, acknowledged: true });
    return problem === 'not-acknowledged' ? null : problem;
  }

  private secretTyped(): TCurrentSecret | null {
    if (this.mode === 'password') {
      return { kind: 'password', password: this.current };
    }
    const recoveryKey = parseRecoveryKey(this.current);
    return recoveryKey.ok ? { kind: 'recovery', recoveryKey: recoveryKey.value } : null;
  }

  setCurrent(current: string): void {
    this.current = current;
  }

  setPassword(password: string): void {
    this.password = password;
  }

  setConfirmation(confirmation: string): void {
    this.confirmation = confirmation;
  }

  async submit(): Promise<void> {
    if (!isNil(this.problem) || this.step.kind === 'changing') {
      return;
    }
    const secret = this.secretTyped();
    if (isNil(secret)) {
      return;
    }
    const { password } = this;
    this.current = '';
    this.password = '';
    this.confirmation = '';
    this.step = { kind: 'changing' };
    const failure = await this.keys.change(secret, password);
    if (secret.kind === 'recovery') {
      secret.recoveryKey.fill(0);
    }
    runInAction(() => {
      this.step = isNil(failure) ? { kind: 'changed' } : { kind: 'editing', failure };
    });
  }
}
