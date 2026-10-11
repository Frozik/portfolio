import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TResult } from '@frozik/utils/result/result';

import { ok } from '@frozik/utils/result/result';
import type { IRandom } from '../ports/random';
import type { IPassphraseOptions } from './passphrase';
import { generatePassphrase } from './passphrase';
import type { IPasswordRules } from './password-rules';
import { generatePin } from './pin';
import type { IGenerated, IRandomPasswordOptions, TGeneratorError } from './random-password';
import { generateRandomPassword } from './random-password';
import type { TRulePasswordError } from './rule-password';
import { generateForRules } from './rule-password';

/** What the generator makes, with the options of that kind. */
export type TGeneratorSettings =
  | { readonly mode: 'random'; readonly options: IRandomPasswordOptions }
  | { readonly mode: 'passphrase'; readonly options: IPassphraseOptions }
  | { readonly mode: 'pin'; readonly length: number }
  /** The rules a site publishes, for a card with its address. */
  | { readonly mode: 'site'; readonly rules: IPasswordRules; readonly length: number };

export type TGeneratorMode = TGeneratorSettings['mode'];

export type TGenerateError = TGeneratorError | TRulePasswordError;

export function generate(
  settings: TGeneratorSettings,
  random: IRandom
): TResult<IGenerated, TGenerateError> {
  switch (settings.mode) {
    case 'random':
      return generateRandomPassword(random, settings.options);
    case 'passphrase':
      return generatePassphrase(random, settings.options);
    case 'pin':
      return ok(generatePin(random, settings.length));
    case 'site':
      return generateForRules(random, settings.rules, settings.length);
    default:
      return assertNever(settings);
  }
}
