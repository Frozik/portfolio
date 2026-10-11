import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';

import type { TBytes } from './bytes';
import { isOperationError } from './operation-error';

/** AES-256-GCM: 96-bit nonce, 128-bit tag appended to the ciphertext. */
export const NONCE_BYTES = 12;
export const TAG_BYTES = 16;

export async function sealBlock(
  key: CryptoKey,
  nonce: TBytes,
  plaintext: TBytes,
  additionalData: TBytes
): Promise<TBytes> {
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData },
    key,
    plaintext
  );
  return new Uint8Array(sealed);
}

export async function openBlock(
  key: CryptoKey,
  nonce: TBytes,
  sealed: TBytes,
  additionalData: TBytes
): Promise<TResult<TBytes, 'authentication-failed'>> {
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce, additionalData },
      key,
      sealed
    );
    return ok(new Uint8Array(plaintext));
  } catch (error) {
    if (isOperationError(error)) {
      return err('authentication-failed');
    }
    throw error;
  }
}
