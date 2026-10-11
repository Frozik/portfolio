import { assertNever } from '@frozik/utils/assert/assertNever';

import type { TCodecError } from '../codec/vault-codec';
import type { TUnlockFailure } from '../lifecycle/lifecycle-state';

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
