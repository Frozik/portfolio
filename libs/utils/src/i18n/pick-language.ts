import type { Language } from './language';
import { DEFAULT_LANGUAGE, isLanguage } from './language';

/**
 * The first supported language among the user's preferred ones (BCP 47 tags,
 * most preferred first); English when none is supported.
 */
export function pickLanguage(tags: readonly string[]): Language {
  for (const tag of tags) {
    const primary = tag.split('-')[0]?.toLowerCase();
    if (isLanguage(primary)) {
      return primary;
    }
  }
  return DEFAULT_LANGUAGE;
}
