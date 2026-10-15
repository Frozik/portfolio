import { assertNever } from '@frozik/utils/assert/assertNever';

import type { TCodecError } from '../codec/vault-codec';

/** Why an unlock failed, each with its own message. */
export type TUnlockFailure =
  | 'wrong-password'
  | 'slot-tampered'
  | 'corrupted'
  | 'unsupported-format'
  | 'unavailable'
  | 'not-found'
  /** The key this device kept no longer opens the vault: a new fingerprint or face was enrolled, or the vault's key changed. */
  | 'biometric-invalidated';

/** Why an unlock failed, in the words the unlock screen has a message for. */
export function unlockFailureOf(error: TCodecError): TUnlockFailure {
  switch (error.kind) {
    case 'wrong-password':
    case 'slot-tampered':
    case 'unsupported-format':
    case 'corrupted':
      return error.kind;
    case 'key-rotated':
    case 'rollback-security':
    case 'zip-limits':
    case 'asset-missing':
      return 'corrupted';
    case 'aborted':
    case 'worker-crashed':
      return 'unavailable';
    default:
      return assertNever(error);
  }
}
