import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import type { IRandom } from '../ports/random';
import type { IPasswordRules } from './password-rules';
import { alphabetOf, meetsPasswordRules } from './password-rules';
import type { IGenerated } from './random-password';
import { MAX_PASSWORD_LENGTH } from './random-password';
import { pickOne, shuffled } from './uniform-pick';

/** A draw breaking `max-consecutive` is drawn again; even "no two alike" over a dozen characters passes most draws. */
const ATTEMPTS = 64;

export type TRulePasswordError = 'site-rules';

/** The lengths the rules leave: at least one character per required set, at most the generator's ceiling. */
export function lengthRangeOf(rules: IPasswordRules): {
  readonly min: number;
  readonly max: number;
} {
  return {
    min: Math.max(rules.minLength ?? 1, rules.required.length),
    max: Math.min(rules.maxLength ?? MAX_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH),
  };
}

/**
 * A password the site's rules accept: one character from
 * each required set, the rest from everything allowed, shuffled; `site-rules`
 * when the rules leave no password at all.
 */
export function generateForRules(
  random: IRandom,
  rules: IPasswordRules,
  preferredLength: number
): TResult<IGenerated, TRulePasswordError> {
  const { min, max } = lengthRangeOf(rules);
  const alphabet = alphabetOf(rules);
  if (
    min > max ||
    (!isNil(rules.maxConsecutive) && alphabet.length === 1 && max > rules.maxConsecutive)
  ) {
    return err('site-rules');
  }
  const length = Math.min(max, Math.max(min, Math.round(preferredLength)));
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const required = rules.required.map(set => pickOne(random, set));
    const rest = Array.from({ length: length - required.length }, () => pickOne(random, alphabet));
    const value = shuffled(random, [...required, ...rest]).join('');
    if (meetsPasswordRules(value, rules)) {
      return ok({ value, entropyBits: length * Math.log2(alphabet.length) });
    }
  }
  return err('site-rules');
}
