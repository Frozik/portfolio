import type { IRandom } from '../ports/random';
import type { TBytes } from './bytes';
import { deriveLabelledBytes, importHkdfKey, KEY_CHECK_BYTES } from './hkdf';

export const DEK_BYTES = 32;
export const KEY_ID_BYTES = 16;

/** One random data key per vault; every other key is derived from it or wraps it. */
export function generateDek(random: IRandom): TBytes {
  return random.bytes(DEK_BYTES);
}

/** The DEK as the session holds it: an HKDF base key that never leaves WebCrypto. */
export function importDek(rawDek: TBytes): Promise<CryptoKey> {
  return importHkdfKey(rawDek);
}

export function deriveKeyCheck(dek: CryptoKey): Promise<TBytes> {
  return deriveLabelledBytes(dek, 'pwv/key-check', KEY_CHECK_BYTES);
}

/** Names the DEK without revealing it; changes only when the key is rotated. */
export async function keyIdOf(keyCheck: TBytes): Promise<TBytes> {
  const digest = await crypto.subtle.digest('SHA-256', keyCheck);
  return new Uint8Array(digest, 0, KEY_ID_BYTES).slice();
}
