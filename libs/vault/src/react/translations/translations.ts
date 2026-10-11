import { vaultReactTranslationsEn } from './en';
import { vaultReactTranslationsRu } from './ru';
import type { IVaultReactTranslations } from './types';

const TRANSLATIONS: Readonly<Record<string, IVaultReactTranslations>> = {
  en: vaultReactTranslationsEn,
  ru: vaultReactTranslationsRu,
};

/** UI strings for the language of a BCP-47 tag; English for languages without a table. */
export function getVaultReactTranslations(locale: string): IVaultReactTranslations {
  const [language = ''] = locale.toLowerCase().split('-');
  return TRANSLATIONS[language] ?? vaultReactTranslationsEn;
}
