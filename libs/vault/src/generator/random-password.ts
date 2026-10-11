import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { uniq } from 'lodash-es';

import type { IRandom } from '../ports/random';
import { pickOne, shuffled } from './uniform-pick';

export interface IRandomPasswordOptions {
  readonly length: number;
  readonly upper: boolean;
  readonly lower: boolean;
  readonly digits: boolean;
  readonly symbols: boolean;
  readonly minDigits: number;
  readonly minSymbols: number;
  /** `Il1O0` and their kin, for passwords read off a screen and typed. */
  readonly excludeSimilar: boolean;
  readonly exclude: string;
}

export const RANDOM_PASSWORD_DEFAULTS: IRandomPasswordOptions = {
  length: 20,
  upper: true,
  lower: true,
  digits: true,
  symbols: true,
  minDigits: 1,
  minSymbols: 1,
  excludeSimilar: false,
  exclude: '',
};

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/~';
const SIMILAR = new Set('Il1O0o|');

export type TGeneratorError = 'no-characters' | 'unsatisfiable';

export interface IGenerated {
  readonly value: string;
  /** Bits of entropy of the method (not of the string), as the generator shows them. */
  readonly entropyBits: number;
}

function characters(
  set: string,
  { excludeSimilar, exclude }: IRandomPasswordOptions
): readonly string[] {
  return uniq([...set]).filter(
    character => !exclude.includes(character) && !(excludeSimilar && SIMILAR.has(character))
  );
}

/**
 * The required digits and symbols are drawn first, the rest
 * from the whole alphabet, then everything is shuffled, so their places are
 * as random as the characters.
 */
export function generateRandomPassword(
  random: IRandom,
  options: IRandomPasswordOptions
): TResult<IGenerated, TGeneratorError> {
  const length = Math.min(
    MAX_PASSWORD_LENGTH,
    Math.max(MIN_PASSWORD_LENGTH, Math.round(options.length))
  );
  const digits = options.digits ? characters(DIGITS, options) : [];
  const symbols = options.symbols ? characters(SYMBOLS, options) : [];
  const alphabet = [
    ...(options.upper ? characters(UPPER, options) : []),
    ...(options.lower ? characters(LOWER, options) : []),
    ...digits,
    ...symbols,
  ];
  const minDigits = options.digits ? options.minDigits : 0;
  const minSymbols = options.symbols ? options.minSymbols : 0;
  if (alphabet.length === 0) {
    return err('no-characters');
  }
  if (
    minDigits + minSymbols > length ||
    (minDigits > 0 && digits.length === 0) ||
    (minSymbols > 0 && symbols.length === 0)
  ) {
    return err('unsatisfiable');
  }
  const required = [
    ...Array.from({ length: minDigits }, () => pickOne(random, digits)),
    ...Array.from({ length: minSymbols }, () => pickOne(random, symbols)),
  ];
  const rest = Array.from({ length: length - required.length }, () => pickOne(random, alphabet));
  return ok({
    value: shuffled(random, [...required, ...rest]).join(''),
    entropyBits: length * Math.log2(alphabet.length),
  });
}
