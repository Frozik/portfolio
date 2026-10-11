import { EValueDescriptorErrorCode } from '@frozik/utils/value-descriptors/codes';
import type { ValueDescriptorFail } from '@frozik/utils/value-descriptors/types';

import { vaultT } from './translations';

/** What happened and what to do, picked by the code the store kept. */
export function registryFailureText(fail: ValueDescriptorFail): string {
  switch (fail.code) {
    case EValueDescriptorErrorCode.RESOURCE_EXHAUSTED:
      return vaultT.failures.quota;
    case EValueDescriptorErrorCode.UNAVAILABLE:
      return vaultT.failures.unavailable;
    default:
      return vaultT.failures.unknown;
  }
}
