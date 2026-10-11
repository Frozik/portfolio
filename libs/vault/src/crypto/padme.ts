import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';

import type { TBytes } from './bytes';

const PADDING_MARKER = 0x80;
const UINT32_BITS = 32;

/**
 * Padmé (PURBs, Nikitin et al. 2019): rounds a length up so
 * that only O(log log n) bits of it leak, at most 12 % overhead.
 */
export function padmeLength(length: number): number {
  if (length < 2) {
    return length;
  }
  const exponent = UINT32_BITS - 1 - Math.clz32(length);
  const exponentBits = UINT32_BITS - Math.clz32(exponent);
  const step = 2 ** (exponent - exponentBits);
  return Math.ceil(length / step) * step;
}

/** ISO/IEC 7816-4: the content, one 0x80 byte, then zeros up to the Padmé length. */
export function pad(content: TBytes): TBytes {
  const padded = new Uint8Array(padmeLength(content.length + 1));
  padded.set(content);
  padded[content.length] = PADDING_MARKER;
  return padded;
}

export function unpad(padded: TBytes): TResult<TBytes, 'corrupted'> {
  let markerIndex = padded.length - 1;
  while (markerIndex >= 0 && padded[markerIndex] === 0) {
    markerIndex -= 1;
  }
  if (markerIndex < 0 || padded[markerIndex] !== PADDING_MARKER) {
    return err('corrupted');
  }
  return ok(padded.slice(0, markerIndex));
}
