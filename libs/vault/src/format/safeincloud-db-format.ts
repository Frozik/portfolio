import type { TBytes } from '../crypto/bytes';
import { utf8 } from '../crypto/bytes';

/** `0x0505`, little-endian: the first two bytes of every SafeInCloud database. */
export const SAFEINCLOUD_MAGIC = [0x05, 0x05] as const;
/** The header's flag for a password written one byte per character rather than as UTF-8. */
export const LATIN1_PASSWORD = 1;
export const UTF8_PASSWORD = 0;
export const SAFEINCLOUD_KEY_BITS = 256;
/** PBKDF2-SHA1 rounds turning the password into the key that opens the data key. */
export const PASSWORD_ROUNDS = 10_000;
/** PBKDF2-SHA1 rounds of the data key's check value, which tells a wrong password apart. */
export const CHECK_ROUNDS = 1_000;

export function safeInCloudPasswordBytes(password: string, latin1: boolean): TBytes {
  return latin1 ? Uint8Array.from(password, character => character.charCodeAt(0)) : utf8(password);
}

export async function pbkdf2Sha1(secret: TBytes, salt: TBytes, rounds: number): Promise<TBytes> {
  const material = await crypto.subtle.importKey('raw', secret, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-1', salt, iterations: rounds },
    material,
    SAFEINCLOUD_KEY_BITS
  );
  return new Uint8Array(bits);
}
