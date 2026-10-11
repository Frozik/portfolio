import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { TBytes } from '../crypto/bytes';
import { fromHexBytes } from '../crypto/bytes';

export function fromHex(hex: string): TBytes {
  const bytes = fromHexBytes(hex);
  assert(!isNil(bytes), `not hex: ${hex}`);
  return bytes;
}
