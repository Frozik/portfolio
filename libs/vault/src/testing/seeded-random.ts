import type { TBytes } from '../crypto/bytes';
import type { IRandom } from '../ports/random';

const MULBERRY_INCREMENT = 0x6d2b79f5;
const BYTE_MASK = 0xff;

/** Deterministic bytes (mulberry32) for tests and golden fixtures — never for keys that matter. */
export function createSeededRandom(seed: number): IRandom {
  let state = seed >>> 0;
  const nextByte = (): number => {
    state = (state + MULBERRY_INCREMENT) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) & BYTE_MASK;
  };
  return {
    bytes: (length: number): TBytes => Uint8Array.from({ length }, nextByte),
  };
}
