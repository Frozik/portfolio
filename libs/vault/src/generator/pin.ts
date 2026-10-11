import type { IRandom } from '../ports/random';
import type { IGenerated } from './random-password';
import { uniformIndex } from './uniform-pick';

export const PIN_DEFAULT_LENGTH = 6;
export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 12;

const DECIMAL = 10;

export function generatePin(random: IRandom, length: number = PIN_DEFAULT_LENGTH): IGenerated {
  const digits = Math.min(MAX_PIN_LENGTH, Math.max(MIN_PIN_LENGTH, Math.round(length)));
  return {
    value: Array.from({ length: digits }, () => String(uniformIndex(random, DECIMAL))).join(''),
    entropyBits: digits * Math.log2(DECIMAL),
  };
}
