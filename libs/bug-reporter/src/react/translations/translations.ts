import { bugReporterTranslationsEn } from './en';
import { bugReporterTranslationsRu } from './ru';
import type { IBugReporterTranslations } from './types';

const TRANSLATIONS: Readonly<Record<string, IBugReporterTranslations>> = {
  en: bugReporterTranslationsEn,
  ru: bugReporterTranslationsRu,
};

/** UI strings for the language of a BCP-47 tag; English for languages without a table. */
export function getBugReporterTranslations(locale: string): IBugReporterTranslations {
  const [language = ''] = locale.toLowerCase().split('-');
  return TRANSLATIONS[language] ?? bugReporterTranslationsEn;
}
