import type { TResult } from '@frozik/utils/result/result';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { TRecoveryKeyError } from '@frozik/vault/crypto/recovery-key';
import { parseRecoveryKey } from '@frozik/vault/crypto/recovery-key';

/** The Emergency Kit's key as typed: a typo is told apart from a wrong key before any unlock. */
export function readRecoveryKey(text: string): TResult<TBytes, TRecoveryKeyError> {
  return parseRecoveryKey(text);
}
