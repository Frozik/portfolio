import { assertNever } from '@frozik/utils/assert/assertNever';
import { EValueDescriptorErrorCode } from '@frozik/utils/value-descriptors/codes';
import { Fail } from '@frozik/utils/value-descriptors/fails/fail';
import type { ValueDescriptorFail } from '@frozik/utils/value-descriptors/types';
import type { TPersistenceError } from '@frozik/vault/persistence/ports';

/** The store keeps the code; presentation picks the text by it. */
export function vaultErrorFail(error: TPersistenceError): ValueDescriptorFail {
  switch (error.kind) {
    case 'quota':
      return Fail(EValueDescriptorErrorCode.RESOURCE_EXHAUSTED, { message: error.kind });
    case 'unavailable':
      return Fail(EValueDescriptorErrorCode.UNAVAILABLE, { message: error.kind });
    default:
      return assertNever(error);
  }
}
