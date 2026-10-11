import { assert } from '@frozik/utils/assert/assert';

import type { IRandom } from '../ports/random';

const UINT32_RANGE = 2 ** 32;
const UINT32_BYTES = 4;

/**
 * A uniform index in `[0, size)`: draws 32 random bits and
 * rejects the top slice that `size` does not divide evenly, so no index is
 * more likely than another (a plain `% size` would favour the small ones).
 */
export function uniformIndex(random: IRandom, size: number): number {
  assert(
    Number.isInteger(size) && size > 0 && size <= UINT32_RANGE,
    'A pick needs a non-empty range'
  );
  const limit = UINT32_RANGE - (UINT32_RANGE % size);
  for (;;) {
    const value = new DataView(random.bytes(UINT32_BYTES).buffer).getUint32(0);
    if (value < limit) {
      return value % size;
    }
  }
}

export function pickOne<T>(random: IRandom, items: readonly T[]): T {
  return items[uniformIndex(random, items.length)];
}

/** Fisher–Yates with uniform indices: every order equally likely. */
export function shuffled<T>(random: IRandom, items: readonly T[]): readonly T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = uniformIndex(random, index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
