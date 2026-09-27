import { tableTranslationsEn } from './en';
import { tableTranslationsRu } from './ru';
import type { ITableTranslations } from './types';

const TRANSLATIONS: Readonly<Record<string, ITableTranslations>> = {
  en: tableTranslationsEn,
  ru: tableTranslationsRu,
};

/** UI strings for the language of a BCP-47 tag; English for languages without a table. */
export function getTableTranslations(locale: string): ITableTranslations {
  const [language = ''] = locale.toLowerCase().split('-');
  return TRANSLATIONS[language] ?? tableTranslationsEn;
}
