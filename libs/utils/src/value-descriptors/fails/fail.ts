import type { TStructurallyCloneable } from '../../types/serialization';

import type { FailConstructor } from './types';
import { FAIL_TAG } from './types';

export const Fail: FailConstructor = ((code: string, meta?: TStructurallyCloneable) => {
  return {
    tag: FAIL_TAG,
    code,
    meta,
  };
}) as unknown as FailConstructor;
