import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BITS_PER_SYMBOL = 5;
const BITS_PER_BYTE = 8;
const BYTE_MASK = 0xff;

/** RFC 4648 base32, as TOTP secrets are written; padding and case are forgiven. */
export function decodeBase32(text: string): TResult<Uint8Array<ArrayBuffer>, 'bad-secret'> {
  const symbols = text.toUpperCase().replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bufferedBits = 0;
  for (const symbol of symbols) {
    const value = ALPHABET.indexOf(symbol);
    if (value < 0) {
      return err('bad-secret');
    }
    buffer = ((buffer << BITS_PER_SYMBOL) | value) & 0xffff;
    bufferedBits += BITS_PER_SYMBOL;
    if (bufferedBits >= BITS_PER_BYTE) {
      bufferedBits -= BITS_PER_BYTE;
      bytes.push((buffer >> bufferedBits) & BYTE_MASK);
    }
  }
  return bytes.length === 0 ? err('bad-secret') : ok(Uint8Array.from(bytes));
}

const SYMBOL_MASK = 0x1f;

/** RFC 4648 base32 without padding: how a secret is written into an `otpauth://` URI. */
export function encodeBase32(bytes: Uint8Array): string {
  let text = '';
  let buffer = 0;
  let bufferedBits = 0;
  for (const byte of bytes) {
    buffer = ((buffer << BITS_PER_BYTE) | byte) & 0xffff;
    bufferedBits += BITS_PER_BYTE;
    while (bufferedBits >= BITS_PER_SYMBOL) {
      bufferedBits -= BITS_PER_SYMBOL;
      text += ALPHABET.charAt((buffer >> bufferedBits) & SYMBOL_MASK);
    }
  }
  return bufferedBits > 0
    ? text + ALPHABET.charAt((buffer << (BITS_PER_SYMBOL - bufferedBits)) & SYMBOL_MASK)
    : text;
}
