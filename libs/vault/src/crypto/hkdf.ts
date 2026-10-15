import type { TBytes } from './bytes';
import { utf8 } from './bytes';

/** Every subkey of the vault, each under its own label. */
export type THkdfLabel =
  | 'pwv/key-check'
  | 'pwv/payload'
  | 'pwv/device-config'
  | 'pwv/draft'
  | 'pwv/device-usage'
  | 'pwv/prf-kek'
  | 'pwv/recovery-kek'
  | 'pwv/blob'
  | 'pwv/quick-kek';

const BITS_PER_BYTE = 8;
const AES_KEY_BITS = 256;
const NO_SALT = new Uint8Array(0);

export const KEY_CHECK_BYTES = 32;

/** Imports key material as the HKDF base key subkeys are derived from; never extractable. */
export function importHkdfKey(material: TBytes): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', material, 'HKDF', false, ['deriveBits', 'deriveKey']);
}

/** RFC 5869 HKDF-SHA-256 with raw salt and info, as the test vectors state them. */
export async function hkdfBytes(
  baseKey: CryptoKey,
  salt: TBytes,
  info: TBytes,
  length: number
): Promise<TBytes> {
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    baseKey,
    length * BITS_PER_BYTE
  );
  return new Uint8Array(bits);
}

export function deriveLabelledBytes(
  baseKey: CryptoKey,
  label: THkdfLabel,
  length: number,
  salt: TBytes = NO_SALT
): Promise<TBytes> {
  return hkdfBytes(baseKey, salt, utf8(label), length);
}

const CIPHER_USAGES: readonly KeyUsage[] = ['encrypt', 'decrypt'];

/** An AES-256-GCM key for one purpose; non-extractable, so it never leaves WebCrypto. */
export function deriveAesKey(
  baseKey: CryptoKey,
  label: THkdfLabel,
  salt: TBytes = NO_SALT,
  usages: readonly KeyUsage[] = CIPHER_USAGES
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: utf8(label) },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    [...usages]
  );
}
