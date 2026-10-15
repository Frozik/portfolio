import type { TGeneratorMode } from '@frozik/vault/generator/generate';
import { generate } from '@frozik/vault/generator/generate';
import type { IGeneratorState } from '@frozik/vault/generator/generator-state';
import {
  generatorSettingsOf,
  initialGeneratorState,
} from '@frozik/vault/generator/generator-state';
import type { TPassphraseSeparator } from '@frozik/vault/generator/passphrase';
import { MAX_PASSPHRASE_WORDS, MIN_PASSPHRASE_WORDS } from '@frozik/vault/generator/passphrase';
import { MAX_PIN_LENGTH, MIN_PIN_LENGTH } from '@frozik/vault/generator/pin';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@frozik/vault/generator/random-password';
import { lengthRangeOf } from '@frozik/vault/generator/rule-password';
import type { ISitePasswordRules } from '@frozik/vault/generator/site-password-rules';
import type { IRandom } from '@frozik/vault/ports/random';
import { isNil } from 'lodash-es';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../kit/Button';
import { Checkbox } from '../kit/Checkbox';
import { GAP, TEXT_SIZE } from '../kit/metrics';
import { Select } from '../kit/Select';
import { Stepper } from '../kit/Stepper';
import { useWidgetTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

const MODES: readonly TGeneratorMode[] = ['random', 'passphrase', 'pin'];
const SEPARATORS: readonly TPassphraseSeparator[] = ['-', ' ', '.', '_', ',', 'digit', 'none'];
const CHARACTER_SETS = ['upper', 'lower', 'digits', 'symbols'] as const;

/**
 * Random characters, words of the EFF list or a PIN, with the method's
 * entropy — and, for a card whose site publishes rules, a password those
 * rules accept, offered first. Every change draws a new value. Nothing is remembered.
 */
export function PasswordGenerator({
  random,
  site,
  onUse,
}: {
  readonly random: IRandom;
  readonly site: ISitePasswordRules | null;
  readonly onUse: (value: string) => void;
}) {
  const palette = usePalette();
  const t = useWidgetTexts().generator;
  const [state, setState] = useState<IGeneratorState>(() => initialGeneratorState(site));
  const [generated, setGenerated] = useState(() =>
    generate(generatorSettingsOf(initialGeneratorState(site), site), random)
  );
  const update = (next: Partial<IGeneratorState>): void => {
    const merged = { ...state, ...next };
    setState(merged);
    setGenerated(generate(generatorSettingsOf(merged, site), random));
  };
  const { mode, randomOptions, passphrase, pinLength, siteLength } = state;
  const siteRange = isNil(site) ? null : lengthRangeOf(site.rules);
  return (
    <View testID="generator" style={styles.generator}>
      <Select
        testID="generator-mode"
        label={t.mode}
        value={mode}
        options={(isNil(site) ? MODES : (['site', ...MODES] as const)).map(value => ({
          value,
          label: t.modes[value],
        }))}
        onChange={value => update({ mode: value })}
      />
      {mode === 'site' && !isNil(site) && !isNil(siteRange) && (
        <>
          <Text style={[styles.note, { color: palette.fgFaint }]}>{t.siteRules(site.domain)}</Text>
          <Stepper
            label={t.length}
            value={Math.min(siteRange.max, Math.max(siteRange.min, siteLength))}
            min={siteRange.min}
            max={siteRange.max}
            onChange={length => update({ siteLength: length })}
          />
        </>
      )}
      {mode === 'random' && (
        <>
          <Stepper
            testID="generator-length"
            label={t.length}
            value={randomOptions.length}
            min={MIN_PASSWORD_LENGTH}
            max={MAX_PASSWORD_LENGTH}
            onChange={length => update({ randomOptions: { ...randomOptions, length } })}
          />
          {CHARACTER_SETS.map(set => (
            <Checkbox
              key={set}
              label={t[set]}
              checked={randomOptions[set]}
              onChange={checked => update({ randomOptions: { ...randomOptions, [set]: checked } })}
            />
          ))}
          <Checkbox
            label={t.excludeSimilar}
            checked={randomOptions.excludeSimilar}
            onChange={excludeSimilar =>
              update({ randomOptions: { ...randomOptions, excludeSimilar } })
            }
          />
        </>
      )}
      {mode === 'passphrase' && (
        <>
          <Stepper
            label={t.words}
            value={passphrase.words}
            min={MIN_PASSPHRASE_WORDS}
            max={MAX_PASSPHRASE_WORDS}
            onChange={words => update({ passphrase: { ...passphrase, words } })}
          />
          <Select
            label={t.separator}
            value={passphrase.separator}
            options={SEPARATORS.map(value => ({ value, label: t.separators[value] }))}
            onChange={separator => update({ passphrase: { ...passphrase, separator } })}
          />
          <Checkbox
            label={t.capitalize}
            checked={passphrase.capitalize}
            onChange={capitalize => update({ passphrase: { ...passphrase, capitalize } })}
          />
          <Checkbox
            label={t.includeDigit}
            checked={passphrase.includeDigit}
            onChange={includeDigit => update({ passphrase: { ...passphrase, includeDigit } })}
          />
        </>
      )}
      {mode === 'pin' && (
        <Stepper
          label={t.length}
          value={pinLength}
          min={MIN_PIN_LENGTH}
          max={MAX_PIN_LENGTH}
          onChange={length => update({ pinLength: length })}
        />
      )}
      {generated.ok ? (
        <>
          <Text testID="generated" selectable={false} style={[styles.value, { color: palette.fg }]}>
            {generated.value.value}
          </Text>
          <Text style={[styles.note, { color: palette.fgFaint }]}>
            {t.entropy(Math.round(generated.value.entropyBits))}
          </Text>
        </>
      ) : (
        <Text testID="generator-problem" style={[styles.note, { color: palette.danger }]}>
          {generated.error === 'site-rules' ? t.siteRulesBroken : t.noCharacters}
        </Text>
      )}
      <Button variant="secondary" label={t.regenerate} onPress={() => update({})} />
      <Button
        testID="generator-use"
        label={t.use}
        disabled={!generated.ok}
        onPress={() => generated.ok && onUse(generated.value.value)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  generator: { gap: GAP },
  value: { fontSize: TEXT_SIZE.heading, fontFamily: 'monospace' },
  note: { fontSize: TEXT_SIZE.caption },
});
