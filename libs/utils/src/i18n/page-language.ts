import type { Language } from './language';
import { isLanguage } from './language';
import { pickLanguage } from './pick-language';

/**
 * The page language. `<html lang>` wins: an inline script in the page sets it
 * from the browser language before any module runs, and prerendered markup
 * was chosen by the same attribute — so React and the HTML can never
 * disagree. Without a document (a build-time prerender) or an attribute
 * (tests) the browser languages decide.
 */
export function pageLanguage(): Language {
  const documentLanguage =
    typeof document === 'undefined' ? undefined : document.documentElement.lang;
  return isLanguage(documentLanguage) ? documentLanguage : pickLanguage(navigator.languages);
}
