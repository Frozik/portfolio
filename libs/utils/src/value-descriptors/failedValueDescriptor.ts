import { reportError } from '../diagnostics/reportError';

import { toFail } from './fails/utils';
import type { UnsyncedValueDescriptor } from './types';
import { createUnsyncedValueDescriptor } from './utils';

/** The unsynced descriptor for a failure, with the cause reported before it is reduced to a fail. */
export function failedValueDescriptor(context: string, error: unknown): UnsyncedValueDescriptor {
  reportError(context, error);

  return createUnsyncedValueDescriptor(toFail(error));
}
