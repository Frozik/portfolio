import type { Language } from '@frozik/utils/i18n/language';

/** Raised whenever the meter's options or its library change what a password scores. */
const SCORING_RULES = 2;

/** Names the scores of one language's dictionaries under these rules. */
export function strengthMeterIdOf(language: Language): string {
  return `zxcvbn:${language}:${SCORING_RULES}`;
}
