import type { OptionsType } from '@zxcvbn-ts/core';
import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import { adjacencyGraphs, dictionary as commonDictionary } from '@zxcvbn-ts/language-common';

import type { Language } from '@frozik/utils/i18n/language';
import type { IPasswordStrength } from '../../keys/domain/master-password';
import type { IStrengthMeter } from '../domain/ports/strength-meter';

async function languageOptions(language: Language): Promise<OptionsType> {
  const { dictionary, translations } =
    language === 'ru'
      ? await import('@zxcvbn-ts/language-ru')
      : await import('@zxcvbn-ts/language-en');
  return {
    translations,
    graphs: adjacencyGraphs,
    dictionary: { ...commonDictionary, ...dictionary },
    useLevenshteinDistance: true,
  };
}

const factories = new Map<Language, Promise<ZxcvbnFactory>>();

function factoryFor(language: Language): Promise<ZxcvbnFactory> {
  const existing = factories.get(language);
  if (existing !== undefined) {
    return existing;
  }
  const created = languageOptions(language).then(options => new ZxcvbnFactory(options));
  factories.set(language, created);
  return created;
}

/** The dictionaries load once per language; only the verdict is returned, never the password. */
export async function estimateStrength(
  password: string,
  userInputs: readonly string[],
  language: Language
): Promise<IPasswordStrength> {
  const { score, crackTimes, feedback } = (await factoryFor(language)).check(password, [
    ...userInputs,
  ]);
  return {
    score,
    offlineCrackTime: crackTimes.offlineSlowHashingXPerSecond.display,
    warning: feedback.warning,
    suggestions: feedback.suggestions,
  };
}

/** The meter on the calling thread: a phone, where the estimate is short next to a frame. */
export function createInThreadStrengthMeter(language: Language): IStrengthMeter {
  return {
    async estimate(password, userInputs, signal) {
      const strength = await estimateStrength(password, userInputs, language);
      return signal.aborted ? null : strength;
    },
    dispose: () => undefined,
  };
}
