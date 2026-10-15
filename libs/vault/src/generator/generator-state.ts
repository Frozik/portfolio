import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import type { TGeneratorMode, TGeneratorSettings } from './generate';
import type { IPassphraseOptions } from './passphrase';
import { PASSPHRASE_DEFAULTS } from './passphrase';
import { PIN_DEFAULT_LENGTH } from './pin';
import type { IRandomPasswordOptions } from './random-password';
import { RANDOM_PASSWORD_DEFAULTS } from './random-password';
import type { ISitePasswordRules } from './site-password-rules';

/** The generator's choices while it is open; nothing of it is remembered. */
export interface IGeneratorState {
  readonly mode: TGeneratorMode;
  readonly randomOptions: IRandomPasswordOptions;
  readonly passphrase: IPassphraseOptions;
  readonly pinLength: number;
  readonly siteLength: number;
}

export function initialGeneratorState(site: ISitePasswordRules | null): IGeneratorState {
  return {
    mode: isNil(site) ? 'random' : 'site',
    randomOptions: RANDOM_PASSWORD_DEFAULTS,
    passphrase: PASSPHRASE_DEFAULTS,
    pinLength: PIN_DEFAULT_LENGTH,
    siteLength: RANDOM_PASSWORD_DEFAULTS.length,
  };
}

export function generatorSettingsOf(
  state: IGeneratorState,
  site: ISitePasswordRules | null
): TGeneratorSettings {
  switch (state.mode) {
    case 'site':
      return isNil(site)
        ? { mode: 'random', options: state.randomOptions }
        : { mode: state.mode, rules: site.rules, length: state.siteLength };
    case 'random':
      return { mode: state.mode, options: state.randomOptions };
    case 'passphrase':
      return { mode: state.mode, options: state.passphrase };
    case 'pin':
      return { mode: state.mode, length: state.pinLength };
    default:
      return assertNever(state.mode);
  }
}
