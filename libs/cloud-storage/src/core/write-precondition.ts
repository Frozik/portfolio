import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import type { IStorageObjectStat, TWritePrecondition } from './storage-provider';

/** Whether a write or a removal may go ahead over what is stored now. */
export function isPreconditionMet(
  precondition: TWritePrecondition,
  current: IStorageObjectStat | null
): boolean {
  switch (precondition.kind) {
    case 'absent':
      return isNil(current);
    case 'match':
      return !isNil(current) && current.rev === precondition.rev;
    case 'overwrite':
      return true;
    default:
      return assertNever(precondition);
  }
}
