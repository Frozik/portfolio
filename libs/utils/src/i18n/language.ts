export const LANGUAGES = ['en', 'ru'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

export function isLanguage(value: string | undefined): value is Language {
  return LANGUAGES.some(language => language === value);
}
