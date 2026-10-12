import { Checkbox } from '@frozik/components/components/RichEditor/Checkbox';
import { NumericEditor } from '@frozik/components/components/RichEditor/NumericEditor';
import { Select } from '@frozik/components/components/select/Select';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { memo, useState } from 'react';

import type { TGeneratorMode, TGeneratorSettings } from '../../generator/generate';
import { generate } from '../../generator/generate';
import type { IPassphraseOptions, TPassphraseSeparator } from '../../generator/passphrase';
import {
  MAX_PASSPHRASE_WORDS,
  MIN_PASSPHRASE_WORDS,
  PASSPHRASE_DEFAULTS,
} from '../../generator/passphrase';
import { MAX_PIN_LENGTH, MIN_PIN_LENGTH, PIN_DEFAULT_LENGTH } from '../../generator/pin';
import type { IRandomPasswordOptions } from '../../generator/random-password';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  RANDOM_PASSWORD_DEFAULTS,
} from '../../generator/random-password';
import { lengthRangeOf } from '../../generator/rule-password';
import type { ISitePasswordRules } from '../../generator/site-password-rules';
import type { IRandom } from '../../ports/random';
import { getVaultReactTranslations } from '../translations/translations';
import styles from './password-generator.module.css';

const MODES: readonly TGeneratorMode[] = ['random', 'passphrase', 'pin'];
const MODES_WITH_SITE: readonly TGeneratorMode[] = ['site', ...MODES];
const SEPARATORS: readonly TPassphraseSeparator[] = ['-', ' ', '.', '_', ',', 'digit', 'none'];
const CHARACTER_SETS = ['upper', 'lower', 'digits', 'symbols'] as const;

interface IGeneratorState {
  readonly mode: TGeneratorMode;
  readonly randomOptions: IRandomPasswordOptions;
  readonly passphrase: IPassphraseOptions;
  readonly pinLength: number;
  readonly siteLength: number;
}

function initialState(site: ISitePasswordRules | null): IGeneratorState {
  return {
    mode: isNil(site) ? 'random' : 'site',
    randomOptions: RANDOM_PASSWORD_DEFAULTS,
    passphrase: PASSPHRASE_DEFAULTS,
    pinLength: PIN_DEFAULT_LENGTH,
    siteLength: RANDOM_PASSWORD_DEFAULTS.length,
  };
}

function settingsOf(state: IGeneratorState, site: ISitePasswordRules | null): TGeneratorSettings {
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

/**
 * The generator: random characters, words of the EFF list
 * or a PIN, with the entropy of the method — and, for a card whose site
 * publishes rules, a password those rules accept, offered first. Every change
 * of an option draws a new value; "Use" hands it to the field that asked.
 * Nothing is remembered.
 */
export const PasswordGenerator = memo(
  ({
    random,
    locale,
    site = null,
    onUse,
  }: {
    readonly random: IRandom;
    readonly locale: string;
    /** The rules the card's site publishes, when Apple's list has them. */
    readonly site?: ISitePasswordRules | null;
    readonly onUse: (value: string) => void;
  }) => {
    const t = getVaultReactTranslations(locale).generator;
    const [state, setState] = useState<IGeneratorState>(() => initialState(site));
    const [generated, setGenerated] = useState(() =>
      generate(settingsOf(initialState(site), site), random)
    );
    const { mode, randomOptions, passphrase, pinLength, siteLength } = state;
    const update = (next: Partial<IGeneratorState>): void => {
      const merged = { ...state, ...next };
      setState(merged);
      setGenerated(generate(settingsOf(merged, site), random));
    };
    const siteRange = isNil(site) ? null : lengthRangeOf(site.rules);
    const setMode = (value: TGeneratorMode): void => update({ mode: value });
    const setRandomOptions = (options: IRandomPasswordOptions): void =>
      update({ randomOptions: options });
    const setPassphrase = (options: IPassphraseOptions): void => update({ passphrase: options });
    const setPinLength = (length: number): void => update({ pinLength: length });

    return (
      <div className={styles.generator}>
        <Select<TGeneratorMode>
          aria-label={t.mode}
          options={(isNil(site) ? MODES : MODES_WITH_SITE).map(value => ({
            value,
            label: t.modes[value],
          }))}
          value={mode}
          onValueChange={setMode}
          locale={locale}
        />
        {mode === 'site' && !isNil(site) && !isNil(siteRange) && (
          <>
            <span className={styles.entropy} data-testid="generator-site-rules">
              {t.siteRules(site.domain)}
            </span>
            <label className={styles.row}>
              <span>{t.length}</span>
              <NumericEditor
                aria-label={t.length}
                value={Math.min(siteRange.max, Math.max(siteRange.min, siteLength))}
                min={siteRange.min}
                max={siteRange.max}
                onValueChange={length => !isNil(length) && update({ siteLength: length })}
                locale={locale}
              />
            </label>
          </>
        )}
        {mode === 'random' && (
          <>
            <label className={styles.row}>
              <span>{t.length}</span>
              <NumericEditor
                aria-label={t.length}
                value={randomOptions.length}
                min={MIN_PASSWORD_LENGTH}
                max={MAX_PASSWORD_LENGTH}
                onValueChange={length =>
                  !isNil(length) && setRandomOptions({ ...randomOptions, length })
                }
                locale={locale}
              />
            </label>
            <div className={styles.row}>
              {CHARACTER_SETS.map(set => (
                <Checkbox
                  key={set}
                  checked={randomOptions[set]}
                  onCheckedChange={checked =>
                    setRandomOptions({ ...randomOptions, [set]: checked })
                  }
                >
                  {t[set]}
                </Checkbox>
              ))}
            </div>
            <Checkbox
              checked={randomOptions.excludeSimilar}
              onCheckedChange={excludeSimilar =>
                setRandomOptions({ ...randomOptions, excludeSimilar })
              }
            >
              {t.excludeSimilar}
            </Checkbox>
          </>
        )}
        {mode === 'passphrase' && (
          <>
            <label className={styles.row}>
              <span>{t.words}</span>
              <NumericEditor
                aria-label={t.words}
                value={passphrase.words}
                min={MIN_PASSPHRASE_WORDS}
                max={MAX_PASSPHRASE_WORDS}
                onValueChange={words => !isNil(words) && setPassphrase({ ...passphrase, words })}
                locale={locale}
              />
            </label>
            <Select<TPassphraseSeparator>
              aria-label={t.separator}
              options={SEPARATORS.map(value => ({ value, label: t.separators[value] }))}
              value={passphrase.separator}
              onValueChange={separator => setPassphrase({ ...passphrase, separator })}
              locale={locale}
            />
            <div className={styles.row}>
              <Checkbox
                checked={passphrase.capitalize}
                onCheckedChange={capitalize => setPassphrase({ ...passphrase, capitalize })}
              >
                {t.capitalize}
              </Checkbox>
              <Checkbox
                checked={passphrase.includeDigit}
                onCheckedChange={includeDigit => setPassphrase({ ...passphrase, includeDigit })}
              >
                {t.includeDigit}
              </Checkbox>
            </div>
          </>
        )}
        {mode === 'pin' && (
          <label className={styles.row}>
            <span>{t.length}</span>
            <NumericEditor
              aria-label={t.length}
              value={pinLength}
              min={MIN_PIN_LENGTH}
              max={MAX_PIN_LENGTH}
              onValueChange={length => !isNil(length) && setPinLength(length)}
              locale={locale}
            />
          </label>
        )}
        {generated.ok ? (
          <>
            <output className={styles.value} aria-live="off">
              {generated.value.value}
            </output>
            <span
              className={styles.entropy}
              data-testid="generator-entropy"
              data-bits={Math.round(generated.value.entropyBits)}
            >
              {t.entropy(Math.round(generated.value.entropyBits))}
            </span>
          </>
        ) : (
          <span
            className={styles.problem}
            data-testid="generator-problem"
            data-state={generated.error}
          >
            {generated.error === 'site-rules' ? t.siteRulesBroken : t.noCharacters}
          </span>
        )}
        <div className={styles.row}>
          <button type="button" className={styles.button} onClick={() => update({})}>
            {t.regenerate}
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={!generated.ok}
            onClick={() => generated.ok && onUse(generated.value.value)}
          >
            {t.use}
          </button>
        </div>
      </div>
    );
  }
);
