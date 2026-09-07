import type { Language } from './types';

const RUSSIAN_LANGUAGE_PREFIX = 'ru';
const SUPPORTED_LANGUAGES: readonly string[] = ['en', 'ru'] satisfies readonly Language[];

function isLanguage(value: string | undefined): value is Language {
  return value !== undefined && SUPPORTED_LANGUAGES.includes(value);
}

/**
 * The page language. `<html lang>` wins: the inline script in `index.html`
 * sets it from the browser language before any module runs, and the
 * prerendered markup that gets hydrated was chosen by the same attribute —
 * so React and the HTML can never disagree. Without a document (the
 * build-time prerender) or an attribute (tests) the browser language decides.
 */
export function getCurrentLanguage(): Language {
  const documentLanguage =
    typeof document === 'undefined' ? undefined : document.documentElement.lang;
  if (isLanguage(documentLanguage)) {
    return documentLanguage;
  }
  return navigator.language.startsWith(RUSSIAN_LANGUAGE_PREFIX) ? 'ru' : 'en';
}
