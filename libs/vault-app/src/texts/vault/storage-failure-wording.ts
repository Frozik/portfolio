import { EValueDescriptorErrorCode } from '@frozik/utils/value-descriptors/codes';
import type { ValueDescriptorFail } from '@frozik/utils/value-descriptors/types';

import type { TVaultTexts } from './vault-texts';

/** What happened to this device's storage and what to do, picked by the code the model kept. */
export function storageFailureText(t: TVaultTexts, fail: ValueDescriptorFail): string {
  switch (fail.code) {
    case EValueDescriptorErrorCode.RESOURCE_EXHAUSTED:
      return t.failures.quota;
    case EValueDescriptorErrorCode.UNAVAILABLE:
      return t.failures.unavailable;
    default:
      return t.failures.unknown;
  }
}
