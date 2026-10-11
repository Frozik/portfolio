import { Crc32 } from '@frozik/utils/hash/crc32';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';

import type { IRandom } from '../ports/random';
import type { TBytes } from './bytes';

export const RECOVERY_KEY_BYTES = 16;

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const BITS_PER_SYMBOL = 5;
const BITS_PER_BYTE = 8;
const SYMBOL_MASK = 0b11111;
const KEY_SYMBOLS = Math.ceil((RECOVERY_KEY_BYTES * BITS_PER_BYTE) / BITS_PER_SYMBOL);
const CHECKSUM_SYMBOLS = 2;
const CHECKSUM_MASK = 0b11_1111_1111;
const GROUP_SIZE = 4;
const SEPARATORS = /[\s-]/g;
const READ_AS_ZERO = /O/g;
const READ_AS_ONE = /[IL]/g;

export type TRecoveryKeyError = 'malformed' | 'checksum-mismatch';

function checksumOf(key: TBytes): number {
  const crc = new Crc32();
  crc.update(key);
  return crc.value & CHECKSUM_MASK;
}

function encodeBits(bytes: TBytes): string {
  let symbols = '';
  let buffer = 0;
  let bufferedBits = 0;
  for (const byte of bytes) {
    buffer = (buffer << BITS_PER_BYTE) | byte;
    bufferedBits += BITS_PER_BYTE;
    while (bufferedBits >= BITS_PER_SYMBOL) {
      bufferedBits -= BITS_PER_SYMBOL;
      symbols += CROCKFORD_ALPHABET[(buffer >> bufferedBits) & SYMBOL_MASK];
    }
  }
  return bufferedBits > 0
    ? symbols + CROCKFORD_ALPHABET[(buffer << (BITS_PER_SYMBOL - bufferedBits)) & SYMBOL_MASK]
    : symbols;
}

/** The inverse of `encodeBits` for a 128-bit key; `null` when the trailing pad bits are not zero. */
function decodeKey(symbols: string): TBytes | null {
  const key = new Uint8Array(RECOVERY_KEY_BYTES);
  let buffer = 0;
  let bufferedBits = 0;
  let written = 0;
  for (const symbol of symbols) {
    buffer = ((buffer << BITS_PER_SYMBOL) | CROCKFORD_ALPHABET.indexOf(symbol)) & 0xffff;
    bufferedBits += BITS_PER_SYMBOL;
    if (bufferedBits >= BITS_PER_BYTE) {
      bufferedBits -= BITS_PER_BYTE;
      key[written] = (buffer >> bufferedBits) & 0xff;
      written += 1;
    }
  }
  return (buffer & ((1 << bufferedBits) - 1)) === 0 ? key : null;
}

function checksumSymbols(key: TBytes): string {
  const checksum = checksumOf(key);
  return (
    (CROCKFORD_ALPHABET[checksum >> BITS_PER_SYMBOL] ?? '') +
    (CROCKFORD_ALPHABET[checksum & SYMBOL_MASK] ?? '')
  );
}

/** 128 bits, shown once in the Emergency Kit. */
export function generateRecoveryKey(random: IRandom): TBytes {
  return random.bytes(RECOVERY_KEY_BYTES);
}

/** Crockford base32 plus two checksum symbols, in groups of four: `XXXX-XXXX-…-XXXX`. */
export function formatRecoveryKey(key: TBytes): string {
  const symbols = encodeBits(key) + checksumSymbols(key);
  return symbols.match(new RegExp(`.{1,${GROUP_SIZE}}`, 'g'))?.join('-') ?? symbols;
}

/** A typed key or part of it as symbols: any case, without dashes or spaces, O as 0, I and L as 1. */
export function recoverySymbols(text: string): string {
  return text
    .toUpperCase()
    .replace(SEPARATORS, '')
    .replace(READ_AS_ZERO, '0')
    .replace(READ_AS_ONE, '1');
}

/**
 * Reads a typed key the way people type it: any case, dashes and spaces
 * anywhere, O for 0, I and L for 1. A wrong checksum is a typo, not a wrong key.
 */
export function parseRecoveryKey(text: string): TResult<TBytes, TRecoveryKeyError> {
  const symbols = recoverySymbols(text);
  if (
    symbols.length !== KEY_SYMBOLS + CHECKSUM_SYMBOLS ||
    [...symbols].some(symbol => !CROCKFORD_ALPHABET.includes(symbol))
  ) {
    return err('malformed');
  }
  const key = decodeKey(symbols.slice(0, KEY_SYMBOLS));
  if (key === null) {
    return err('malformed');
  }
  return symbols.slice(KEY_SYMBOLS) === checksumSymbols(key) ? ok(key) : err('checksum-mismatch');
}
