import { assert } from '@frozik/utils/assert/assert';

import type { TColumns } from '../../core/series/columns';

const NO_TIMES = new BigInt64Array(0);

/**
 * The X column of a time series: bigint nanoseconds, or the source broke the
 * contract. An empty answer given as objects carries no type to tell by.
 */
export function timesOf(columns: TColumns): BigInt64Array {
  if (columns.length === 0) {
    return NO_TIMES;
  }
  assert(columns.x instanceof BigInt64Array, 'a time series is positioned by bigint nanoseconds');
  return columns.x;
}
