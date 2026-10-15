import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TRecoveryKeyError } from '@frozik/vault/crypto/recovery-key';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import type { TKeyRotationFailure } from '../../keys/application/KeyRotation';
import type { TVaultTexts } from '../vault/vault-texts';
import type { TKeysTexts } from './keys-texts';

import type { TChangePasswordProblem } from '../../keys/application/ChangePasswordForm';
import type { CreateVaultForm } from '../../keys/application/CreateVaultForm';
import { MASTER_PASSWORD_MIN_LENGTH } from '../../keys/domain/master-password';
import type { TPasskeyFailure } from '../../keys/domain/ports/passkeys';

interface IKeyTexts {
  readonly keys: TKeysTexts;
  readonly vault: TVaultTexts;
}

export function createVaultProblemText(
  t: TVaultTexts,
  problem: NonNullable<CreateVaultForm['problem']>
): string {
  const { problems } = t.create;
  switch (problem) {
    case 'no-name':
      return problems['no-name'];
    case 'too-short':
      return problems['too-short'](MASTER_PASSWORD_MIN_LENGTH);
    case 'mismatch':
      return problems.mismatch;
    case 'not-acknowledged':
      return problems['not-acknowledged'];
    default:
      return assertNever(problem);
  }
}

export function changePasswordProblemText(t: TKeysTexts, problem: TChangePasswordProblem): string {
  const { problems } = t.changePassword;
  switch (problem) {
    case 'too-short':
      return problems['too-short'](MASTER_PASSWORD_MIN_LENGTH);
    case 'malformed':
    case 'checksum-mismatch':
      return t.recoveryKeyProblems[problem];
    case 'no-current':
    case 'mismatch':
      return problems[problem];
    default:
      return assertNever(problem);
  }
}

export function passkeyFailureText(
  texts: IKeyTexts,
  failure: TPasskeyFailure | TUnlockFailure
): string {
  switch (failure) {
    case 'unsupported':
    case 'cancelled':
    case 'no-prf':
    case 'failed':
      return texts.keys.passkeys.failures[failure];
    default:
      return texts.vault.unlock.failures[failure];
  }
}

export function recoveryUnlockFailureText(
  texts: IKeyTexts,
  failure: TUnlockFailure | TRecoveryKeyError
): string {
  switch (failure) {
    case 'malformed':
    case 'checksum-mismatch':
      return texts.keys.recoveryKeyProblems[failure];
    case 'wrong-password':
      return texts.keys.unlock.wrongKey;
    default:
      return texts.vault.unlock.failures[failure];
  }
}

/** Why a key rotation or a follow did not happen, in the words of either table. */
export function rotationFailureText(
  texts: { readonly keys: TKeysTexts; readonly vault: TVaultTexts },
  failure: TKeyRotationFailure
): string {
  switch (failure) {
    case 'not-synced':
    case 'changed-meanwhile':
    case 'rollback-security':
      return texts.keys.rotation.failures[failure];
    default:
      return texts.vault.unlock.failures[failure];
  }
}
