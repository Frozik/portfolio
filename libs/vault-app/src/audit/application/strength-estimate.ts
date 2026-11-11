import type { OptionsType } from '@zxcvbn-ts/core';
import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import { adjacencyGraphs, dictionary as commonDictionary } from '@zxcvbn-ts/language-common';

import type { Language } from '@frozik/utils/i18n/language';
import type { IPasswordStrength } from '../../keys/domain/master-password';
import type { IStrengthMeter } from '../domain/ports/strength-meter';
import { strengthMeterIdOf } from '../domain/strength-meter-id';

const L33T_VARIANTS = 4;

async function languageOptions(language: Language): Promise<OptionsType> {
  const { dictionary, translations } =
    language === 'ru'
      ? await import('@zxcvbn-ts/language-ru')
      : await import('@zxcvbn-ts/language-en');
  return {
    translations,
    graphs: adjacencyGraphs,
    dictionary: { ...commonDictionary, ...dictionary },
    // Misspelt words cost ~15× and a hundred l33t variants ~10× per password, every score kept on
    // l33t-heavy samples: a phone's audit of 200 never finished, now it takes about a second.
    useLevenshteinDistance: false,
    l33tMaxSubstitutions: L33T_VARIANTS,
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

function nextTurn(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

/**
 * The meter on the calling thread: a phone, where one estimate is short next to a frame. Each
 * waits for the next turn of the event loop first: awaits alone never leave the microtask queue,
 * so the audit of an import's hundreds of passwords froze the screen and held back the vault's
 * write until all of them were done.
 */
export function createInThreadStrengthMeter(language: Language): IStrengthMeter {
  return {
    id: strengthMeterIdOf(language),
    async estimate(password, userInputs, signal) {
      await nextTurn();
      if (signal.aborted) {
        return null;
      }
      const strength = await estimateStrength(password, userInputs, language);
      return signal.aborted ? null : strength;
    },
    dispose: () => undefined,
  };
}
