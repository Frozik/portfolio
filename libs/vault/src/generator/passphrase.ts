import type { TResult } from '@frozik/utils/result/result';
import { ok } from '@frozik/utils/result/result';

import words from '../data/eff-large-wordlist/words.json';
import type { IRandom } from '../ports/random';
import type { IGenerated, TGeneratorError } from './random-password';
import { pickOne, uniformIndex } from './uniform-pick';

export type TPassphraseSeparator = '-' | ' ' | '.' | '_' | ',' | 'digit' | 'none';

export interface IPassphraseOptions {
  readonly words: number;
  readonly separator: TPassphraseSeparator;
  readonly capitalize: boolean;
  readonly includeDigit: boolean;
}

export const PASSPHRASE_DEFAULTS: IPassphraseOptions = {
  words: 5,
  separator: '-',
  capitalize: false,
  includeDigit: false,
};

export const MIN_PASSPHRASE_WORDS = 3;
export const MAX_PASSPHRASE_WORDS = 12;

const DECIMAL = 10;
const WORDLIST: readonly string[] = words;

function separatorFor(random: IRandom, separator: TPassphraseSeparator): string {
  switch (separator) {
    case 'digit':
      return String(uniformIndex(random, DECIMAL));
    case 'none':
      return '';
    default:
      return separator;
  }
}

/** Words of the EFF large wordlist (CC BY, credited in "About"), drawn uniformly. */
export function generatePassphrase(
  random: IRandom,
  options: IPassphraseOptions
): TResult<IGenerated, TGeneratorError> {
  const count = Math.min(
    MAX_PASSPHRASE_WORDS,
    Math.max(MIN_PASSPHRASE_WORDS, Math.round(options.words))
  );
  const chosen = Array.from({ length: count }, () => {
    const word = pickOne(random, WORDLIST);
    return options.capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  });
  const withDigit = options.includeDigit
    ? chosen.map((word, index) =>
        index === count - 1 ? word + String(uniformIndex(random, DECIMAL)) : word
      )
    : chosen;
  const value = withDigit.reduce(
    (joined, word, index) =>
      index === 0 ? word : joined + separatorFor(random, options.separator) + word,
    ''
  );
  const separatorBits = options.separator === 'digit' ? (count - 1) * Math.log2(DECIMAL) : 0;
  const digitBits = options.includeDigit ? Math.log2(DECIMAL) : 0;
  return ok({ value, entropyBits: count * Math.log2(WORDLIST.length) + separatorBits + digitBits });
}
