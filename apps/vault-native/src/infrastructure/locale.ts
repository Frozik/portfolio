import type { Language } from '@frozik/utils/i18n/language';
import { pickLanguage } from '@frozik/utils/i18n/pick-language';
import { getLocales } from 'expo-localization';

/** The phone's preferred languages, most preferred first: the first the app speaks wins. */
export function phoneLanguage(): Language {
  return pickLanguage(getLocales().map(locale => locale.languageTag));
}
