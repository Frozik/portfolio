import type { Language } from './types';

const RUSSIAN_LANGUAGE_PREFIX = 'ru';

export function getCurrentLanguage(): Language {
  return navigator.language.startsWith(RUSSIAN_LANGUAGE_PREFIX) ? 'ru' : 'en';
}
